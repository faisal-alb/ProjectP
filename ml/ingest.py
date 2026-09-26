from __future__ import annotations

"""Real-data ingestion for the spike model.

Replaces the synthetic generator in ``train_spike_model`` with public ERCOT and
Open-Meteo data. Everything fetched here is either an *actual* observed at or
before time ``t`` or a *forecast*, so no feature encodes knowledge of the future
that a live caller would not have.

Availability, measured against the live sources:

* Real-time prices backfill to 2011 via ERCOT's yearly settlement-point archive.
* Weather actuals and as-issued forecasts backfill to 2021 via Open-Meteo.
* ERCOT load forecasts and outage capacity are served from the MIS document
  listing, which only retains a short rolling window. They are **not**
  backfillable without ERCOT Public API credentials, so the backfill path omits
  them; see ``fetch_recent_load_forecast``.
"""

import argparse
import time
from pathlib import Path
from typing import Sequence

import pandas as pd
import requests

# Austin Energy's ERCOT load zone. ERCOT has no settlement point literally named
# "LZ_AUSTIN"; LZ_AEN is the Austin Energy zone the spec's `lz_austin_price` means.
AUSTIN_LOAD_ZONE = "LZ_AEN"

# Downtown Austin, used for both weather endpoints.
AUSTIN_LAT = 30.2672
AUSTIN_LON = -97.7431

CACHE_DIR = Path(__file__).resolve().parent / "data_cache"

OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_HISTORICAL_FORECAST = "https://historical-forecast-api.open-meteo.com/v1/forecast"
OPEN_METEO_PREVIOUS_RUNS = "https://previous-runs-api.open-meteo.com/v1/forecast"

# Open-Meteo's forecast archive begins in 2021. Earlier dates silently fall back
# to reanalysis (i.e. actuals), which would leak the target, so do not go below.
FORECAST_ARCHIVE_START_YEAR = 2021


# Market regimes that may be excluded from modelling. Opt-in, not automatic.
#
# Recommended for the *price* statistics (E[price|spike] and friends), where Uri's
# near-cap prices inflate a number that multiplies straight into fair_value.
# NOT recommended for the spike classifier: under the current walk-forward split
# Uri falls entirely in the initial training window, so excluding it removes 26% of
# positive training examples without removing anything from the evaluation, and
# measured PR-AUC fell from 0.4601 to 0.4181 with wider fold-to-fold variance.
#
# Winter Storm Uri: ERCOT was in load shed with prices pinned near the then-$9,000
# offer cap. It supplies 83% of all intervals above $4,000/MWh in 2021-2024 (437 of
# 529) and 26% of all spike labels, from one week. Two reasons it is excluded rather
# than down-weighted: the cap was lowered afterwards, so those price levels are not
# reachable under current market rules (yearly max steps 9,902 -> 5,991 -> 6,018 ->
# 4,981), and the driver was generation freeze-off and load shed, a mechanism none
# of the available features represent.
REGIME_EXCLUSIONS = {
    "uri": ("2021-02-13", "2021-02-21"),
}


def drop_excluded_regimes(
    df: pd.DataFrame,
    horizons: Sequence[int] = (1, 2, 3, 4, 5, 6),
    exclusions: dict | None = None,
    lag_lookback_h: int = 24,
    verbose: bool = True,
) -> pd.DataFrame:
    """Remove excluded regimes, plus the rows contaminated by them.

    Call this *after* ``build_feature_frame``. Lags and labels must be computed
    on the contiguous price series first, otherwise dropping a window splices
    the series either side of the gap and silently corrupts both.

    Even then the window's edges bleed, so two buffers are also dropped:

    * ``max(horizons)`` hours *before* the window -- those rows' forward label
      windows look into the excluded regime, so their labels are regime-derived.
    * ``lag_lookback_h`` hours *after* it -- those rows' ``price_lag_96`` and
      ``rolling_price_max_24h`` features read back into it.
    """
    exclusions = REGIME_EXCLUSIONS if exclusions is None else exclusions
    if not exclusions:
        return df

    out = df.copy()
    label_buffer = pd.Timedelta(hours=max(horizons))
    lag_buffer = pd.Timedelta(hours=lag_lookback_h)
    mask = pd.Series(False, index=out.index)

    for name, (start, end) in exclusions.items():
        lo = pd.Timestamp(start) - label_buffer
        hi = pd.Timestamp(end) + lag_buffer
        hit = (out["ts"] >= lo) & (out["ts"] < hi)
        if verbose:
            core = (out["ts"] >= pd.Timestamp(start)) & (out["ts"] < pd.Timestamp(end))
            print(
                f"[regime] excluding {name} {start}..{end}: {core.sum():,} rows "
                f"+ {hit.sum() - core.sum():,} buffer rows "
                f"({out.loc[core, 'spike_1h'].sum() if 'spike_1h' in out else 0:,} spike labels)"
            )
        mask |= hit

    return out[~mask].reset_index(drop=True)


def _cache_path(name: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / name


def fetch_ercot_prices(
    start_year: int,
    end_year: int,
    zone: str = AUSTIN_LOAD_ZONE,
    use_cache: bool = True,
) -> pd.DataFrame:
    """Fetch 15-minute real-time settlement point prices for one load zone.

    Returns tz-naive local (US/Central) ``ts`` plus ``lz_austin_price`` in $/MWh,
    matching the column the feature builder expects.
    """
    import gridstatus

    cache = _cache_path(f"ercot_rtm_{zone}_{start_year}_{end_year}.parquet")
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    iso = gridstatus.Ercot()
    frames = []
    for year in range(start_year, end_year + 1):
        print(f"[ercot] fetching {year} real-time settlement point prices...")
        raw = iso.get_rtm_spp(year)
        sub = raw[raw["Location"] == zone]
        if sub.empty:
            raise ValueError(f"No rows for zone {zone} in {year}")
        frames.append(sub[["Interval Start", "SPP"]])

    df = pd.concat(frames, ignore_index=True)
    df = df.rename(columns={"Interval Start": "ts", "SPP": "lz_austin_price"})
    # Drop the tz so it lines up with the naive weather grid below.
    df["ts"] = pd.to_datetime(df["ts"]).dt.tz_localize(None)
    df = df.drop_duplicates("ts").sort_values("ts").reset_index(drop=True)

    df.to_parquet(cache, index=False)
    return df


def _open_meteo(url: str, params: dict, retries: int = 3) -> dict:
    for attempt in range(retries):
        resp = requests.get(url, params=params, timeout=90)
        if resp.status_code == 200:
            return resp.json()
        # Open-Meteo rate-limits with 429; back off and retry.
        if resp.status_code == 429 and attempt < retries - 1:
            time.sleep(5 * (attempt + 1))
            continue
        resp.raise_for_status()
    raise RuntimeError(f"Open-Meteo request failed after {retries} attempts: {url}")


def fetch_weather_actuals(
    start: str,
    end: str,
    lat: float = AUSTIN_LAT,
    lon: float = AUSTIN_LON,
    use_cache: bool = True,
) -> pd.DataFrame:
    """Hourly observed temperature and cloud cover (reanalysis)."""
    cache = _cache_path(f"weather_actuals_{start}_{end}.parquet")
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    print(f"[open-meteo] fetching weather actuals {start} -> {end}...")
    payload = _open_meteo(
        OPEN_METEO_ARCHIVE,
        {
            "latitude": lat,
            "longitude": lon,
            "start_date": start,
            "end_date": end,
            "hourly": "temperature_2m,cloud_cover",
            "temperature_unit": "fahrenheit",
            "timezone": "US/Central",
        },
    )
    hourly = payload["hourly"]
    df = pd.DataFrame(
        {
            "ts": pd.to_datetime(hourly["time"]),
            "temp_f": hourly["temperature_2m"],
            "cloud_cover": hourly["cloud_cover"],
        }
    )
    df.to_parquet(cache, index=False)
    return df


def fetch_weather_forecasts(
    start: str,
    end: str,
    lat: float = AUSTIN_LAT,
    lon: float = AUSTIN_LON,
    lead: str = "day_ahead",
    use_cache: bool = True,
) -> pd.DataFrame:
    """Hourly *forecast* temperature and cloud cover, as issued at the time.

    Two lead-time modes, which bracket the true operating lead of 1-6 hours:

    ``short``
        The Historical Forecast API, stitched from the most recent model run for
        each target hour. Effective lead is well under an hour, so a feature
        built as "forecast for t + 6h" carries less error than a real 6-hour-lead
        forecast would. This is an *optimistic* bound -- it flatters the longer
        horizons.
    ``day_ahead`` (default)
        The Previous Model Runs API, using the run from ~24 hours earlier. Lead
        is at least 24h, strictly longer than any horizon the model serves, so
        forecast error is strictly worse than production would see. This is a
        *conservative* bound. Measured against actuals over July 2024, it carries
        2.3 F MAE (vs 3.3 F at ``previous_day2``), so the error is real and grows
        with lead time as expected.

    Train with ``day_ahead`` unless you specifically want the optimistic bound;
    true performance sits between the two.
    """
    if lead not in ("short", "day_ahead"):
        raise ValueError(f"lead must be 'short' or 'day_ahead', got {lead!r}")

    cache = _cache_path(f"weather_forecast_{lead}_{start}_{end}.parquet")
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    print(f"[open-meteo] fetching as-issued weather forecasts ({lead}) {start} -> {end}...")
    if lead == "short":
        url = OPEN_METEO_HISTORICAL_FORECAST
        hourly = "temperature_2m,cloud_cover"
        temp_key, cloud_key = "temperature_2m", "cloud_cover"
    else:
        url = OPEN_METEO_PREVIOUS_RUNS
        hourly = "temperature_2m_previous_day1,cloud_cover_previous_day1"
        temp_key, cloud_key = "temperature_2m_previous_day1", "cloud_cover_previous_day1"

    payload = _open_meteo(
        url,
        {
            "latitude": lat,
            "longitude": lon,
            "start_date": start,
            "end_date": end,
            "hourly": hourly,
            "temperature_unit": "fahrenheit",
            "timezone": "US/Central",
        },
    )
    block = payload["hourly"]
    df = pd.DataFrame(
        {
            "ts": pd.to_datetime(block["time"]),
            "fc_temp_f": pd.to_numeric(block[temp_key]),
            "fc_cloud_cover": pd.to_numeric(block[cloud_key]),
        }
    )
    df.to_parquet(cache, index=False)
    return df


def fetch_recent_load_forecast(days_back: int = 3) -> pd.DataFrame:
    """Best-effort ERCOT seven-day load forecast for the recent window.

    ERCOT's MIS document listing retains only a short rolling window, so this
    cannot backfill history -- it raises for older dates. Run it on a schedule to
    accumulate as-issued forecasts going forward, or use ERCOT Public API
    credentials (``gridstatus.ErcotAPI``) for deep history.
    """
    import gridstatus

    iso = gridstatus.Ercot()
    start = (pd.Timestamp.now(tz="US/Central") - pd.Timedelta(days=days_back)).normalize()
    return iso.get_load_forecast(start)


def build_real_dataset(
    start_year: int = 2021,
    end_year: int = 2024,
    horizons: Sequence[int] = (1, 2, 3, 4, 5, 6),
    lead: str = "day_ahead",
    use_cache: bool = True,
) -> pd.DataFrame:
    """Assemble the raw frame that ``build_feature_frame`` consumes.

    Produces the same contract as the synthetic generator minus the columns that
    are not backfillable (``load_forecast_*h``, ``outage_mw``). The training
    script intersects against ``DEFAULT_FEATURE_COLUMNS``, so the missing columns
    are dropped rather than fabricated.
    """
    if start_year < FORECAST_ARCHIVE_START_YEAR:
        raise ValueError(
            f"start_year must be >= {FORECAST_ARCHIVE_START_YEAR}: Open-Meteo's forecast "
            "archive does not cover earlier dates and silently returns reanalysis "
            "(actuals) instead, which would leak the target."
        )

    prices = fetch_ercot_prices(start_year, end_year, use_cache=use_cache)

    start = f"{start_year}-01-01"
    end = f"{end_year}-12-31"
    actuals = fetch_weather_actuals(start, end, use_cache=use_cache)
    forecasts = fetch_weather_forecasts(start, end, lead=lead, use_cache=use_cache)

    weather = actuals.merge(forecasts, on="ts", how="outer").sort_values("ts")

    # Prices are 15-minute; weather is hourly. Upsample weather onto the price
    # grid with interpolation rather than downsampling the prices, since the
    # spike label needs 15-minute resolution.
    df = prices.merge(weather, on="ts", how="left").sort_values("ts").reset_index(drop=True)
    for col in ["temp_f", "cloud_cover", "fc_temp_f", "fc_cloud_cover"]:
        df[col] = df[col].interpolate(limit_direction="both")

    # Forecast features: what the models said about t + h, known at t.
    steps_per_hour = 4
    for h in horizons:
        df[f"forecast_temp_{h}h"] = df["fc_temp_f"].shift(-h * steps_per_hour)
    df["cloud_cover"] = df["fc_cloud_cover"]

    df = df.drop(columns=["fc_temp_f", "fc_cloud_cover"])
    # Trailing rows lack a full forecast horizon.
    df = df.dropna(subset=[f"forecast_temp_{h}h" for h in horizons]).reset_index(drop=True)
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill real ERCOT + weather data.")
    parser.add_argument("--start-year", type=int, default=2021)
    parser.add_argument("--end-year", type=int, default=2024)
    parser.add_argument("--lead", choices=("day_ahead", "short"), default="day_ahead")
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--out", type=str, default=str(_cache_path("real_dataset.parquet")))
    args = parser.parse_args()

    df = build_real_dataset(
        start_year=args.start_year,
        end_year=args.end_year,
        lead=args.lead,
        use_cache=not args.no_cache,
    )
    df.to_parquet(args.out, index=False)
    price = df["lz_austin_price"]
    print(f"Rows: {len(df):,}  span: {df['ts'].min()} -> {df['ts'].max()}")
    print(f"Price $/MWh  median={price.median():.2f}  max={price.max():.2f}")
    print(f"Intervals above $500/MWh: {(price > 500).sum():,} ({100 * (price > 500).mean():.3f}%)")
    print(f"Saved {args.out}")


if __name__ == "__main__":
    main()
