from __future__ import annotations

"""Household load ingestion from NREL ResStock, for the baseline model.

The baseline model estimates what a home *would* have drawn absent an event --
the counterfactual that settlement is measured against. Training it on the
project's own simulator would mean learning the simulator's load formula, so
this pulls real, physics-calibrated profiles instead. See
``docs/09_HOME_MODELS_PLAN.md`` §2.2.

Source: NREL End-Use Load Profiles, ResStock AMY2018 release 2, public on the
OEDI data lake (no credentials). Travis County, TX -- the same geography as the
``LZ_AEN`` prices in ``ml/ingest.py``. 1,961 homes, 15-minute resolution over
calendar 2018, with end uses broken out.

Two conventions differ from the ERCOT side and are normalised here:

* ResStock timestamps mark the interval **end**; ERCOT marks the **start**.
* ResStock runs on local standard time year-round (no DST), so weather is
  fetched in UTC and shifted by a fixed -6h rather than via a DST-aware zone.
"""

import argparse
import sys
from pathlib import Path
from typing import Sequence

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd

BUCKET = "oedi-data-lake"
RELEASE = (
    "nrel-pds-building-stock/end-use-load-profiles-for-us-building-stock/"
    "2024/resstock_amy2018_release_2"
)
COUNTY_NAME = "Travis"
STATE = "TX"

# ResStock AMY2018 covers calendar 2018 only.
DATA_YEAR = 2018
CST_OFFSET_HOURS = -6

CACHE_DIR = Path(__file__).resolve().parent / "data_cache"

# Metadata describing each home; these become static model features.
META_COLUMNS = [
    "bldg_id",
    "in.state",
    "in.county_name",
    "in.sqft",
    "in.occupants",
    "in.bedrooms",
    "in.vintage",
    "in.hvac_cooling_type",
    "in.has_pv",
    "in.pv_system_size",
]

# End uses worth carrying: total is the target, the rest bound what a home can
# actually shed (HVAC) or export (PV).
SERIES_COLUMNS = {
    "out.electricity.total.energy_consumption": "total_kwh",
    "out.electricity.cooling.energy_consumption": "cooling_kwh",
    "out.electricity.heating.energy_consumption": "heating_kwh",
    "out.electricity.plug_loads.energy_consumption": "plug_kwh",
    "out.electricity.pv.energy_consumption": "pv_kwh",
}


def _fs():
    import s3fs

    return s3fs.S3FileSystem(anon=True)


def _cache(name: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / name


def fetch_home_metadata(use_cache: bool = True) -> pd.DataFrame:
    """Static characteristics for every Travis County home in the release."""
    cache = _cache(f"resstock_{COUNTY_NAME.lower()}_metadata.parquet")
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    import pyarrow.parquet as pq

    print(f"[resstock] fetching metadata for {COUNTY_NAME} County, {STATE}...")
    fs = _fs()
    with fs.open(f"{BUCKET}/{RELEASE}/metadata/baseline.parquet") as handle:
        # bldg_id is the pandas index column: it must be requested explicitly or
        # the frame comes back with a positional RangeIndex whose values look
        # like ids but are not.
        table = pq.read_table(handle, columns=META_COLUMNS)

    meta = table.to_pandas()
    meta = meta[
        (meta["in.state"] == STATE)
        & (meta["in.county_name"].str.contains(COUNTY_NAME, na=False))
    ].copy()
    meta.index.name = "bldg_id"
    meta.to_parquet(cache)
    print(f"[resstock] {len(meta):,} homes in {COUNTY_NAME} County")
    return meta


def fetch_home_timeseries(
    bldg_ids: Sequence[int],
    use_cache: bool = True,
) -> pd.DataFrame:
    """Per-home 15-minute load for the given buildings, long format.

    Only the columns in ``SERIES_COLUMNS`` are read. Each building file holds
    137 columns and ~5.4 MB; column projection keeps the transfer small enough
    to pull a useful sample of homes.
    """
    cache = _cache(f"resstock_{COUNTY_NAME.lower()}_ts_{len(bldg_ids)}.parquet")
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    import pyarrow.parquet as pq

    fs = _fs()
    wanted = list(SERIES_COLUMNS)
    frames = []
    for i, bldg_id in enumerate(bldg_ids, 1):
        key = (
            f"{BUCKET}/{RELEASE}/timeseries_individual_buildings/by_state/"
            f"upgrade=0/state={STATE}/{bldg_id}-0.parquet"
        )
        with fs.open(key) as handle:
            df = pq.read_table(handle, columns=["timestamp"] + wanted).to_pandas()
        df = df.rename(columns=SERIES_COLUMNS)
        df["bldg_id"] = bldg_id
        frames.append(df)
        if i % 10 == 0 or i == len(bldg_ids):
            print(f"[resstock] {i}/{len(bldg_ids)} homes")

    out = pd.concat(frames, ignore_index=True)
    out["ts"] = pd.to_datetime(out["timestamp"]) - pd.Timedelta(minutes=15)
    out = out.drop(columns=["timestamp"])
    out = out[["bldg_id", "ts"] + list(SERIES_COLUMNS.values())]
    out = out.sort_values(["bldg_id", "ts"]).reset_index(drop=True)
    out.to_parquet(cache, index=False)
    return out


def fetch_weather_local_standard(use_cache: bool = True) -> pd.DataFrame:
    """Austin weather for the ResStock year, on ResStock's clock.

    Fetched in UTC and shifted by a fixed -6h. ResStock has no DST, so using a
    DST-aware zone would misalign the series by an hour for half the year.
    """
    cache = _cache(f"resstock_weather_{DATA_YEAR}.parquet")
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    from ml.ingest import AUSTIN_LAT, AUSTIN_LON, OPEN_METEO_ARCHIVE, _open_meteo

    print(f"[open-meteo] fetching {DATA_YEAR} weather actuals (UTC -> CST)...")
    payload = _open_meteo(
        OPEN_METEO_ARCHIVE,
        {
            "latitude": AUSTIN_LAT,
            "longitude": AUSTIN_LON,
            "start_date": f"{DATA_YEAR - 1}-12-31",
            "end_date": f"{DATA_YEAR}-12-31",
            "hourly": "temperature_2m,cloud_cover,relative_humidity_2m",
            "temperature_unit": "fahrenheit",
            "timezone": "UTC",
        },
    )
    hourly = payload["hourly"]
    df = pd.DataFrame(
        {
            "ts": pd.to_datetime(hourly["time"]) + pd.Timedelta(hours=CST_OFFSET_HOURS),
            "temp_f": hourly["temperature_2m"],
            "cloud_cover": hourly["cloud_cover"],
            "humidity": hourly["relative_humidity_2m"],
        }
    )
    df.to_parquet(cache, index=False)
    return df


def build_home_dataset(
    n_homes: int = 50,
    seed: int = 42,
    use_cache: bool = True,
) -> pd.DataFrame:
    """Assemble per-home load joined to weather and home characteristics."""
    meta = fetch_home_metadata(use_cache=use_cache)
    sample = meta.sample(n=min(n_homes, len(meta)), random_state=seed)
    ts = fetch_home_timeseries(list(sample.index), use_cache=use_cache)

    weather = fetch_weather_local_standard(use_cache=use_cache).sort_values("ts")
    # Weather is hourly, load is 15-minute: interpolate onto the load grid
    # rather than downsampling the target.
    df = ts.merge(weather, on="ts", how="left").sort_values(["bldg_id", "ts"])
    for col in ["temp_f", "cloud_cover", "humidity"]:
        df[col] = df.groupby("bldg_id")[col].transform(
            lambda s: s.interpolate(limit_direction="both")
        )

    static = sample[["in.sqft", "in.occupants", "in.bedrooms", "in.has_pv"]].rename(
        columns={
            "in.sqft": "sqft",
            "in.occupants": "occupants",
            "in.bedrooms": "bedrooms",
            "in.has_pv": "has_pv",
        }
    )
    df = df.merge(static, left_on="bldg_id", right_index=True, how="left")
    return df.reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest ResStock household load.")
    parser.add_argument("--homes", type=int, default=50)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-cache", action="store_true")
    args = parser.parse_args()

    df = build_home_dataset(n_homes=args.homes, seed=args.seed, use_cache=not args.no_cache)
    print(f"\nrows={len(df):,}  homes={df.bldg_id.nunique()}  "
          f"span={df.ts.min()} -> {df.ts.max()}")
    print(f"total_kwh per interval: mean={df.total_kwh.mean():.4f} "
          f"p50={df.total_kwh.median():.4f} p99={df.total_kwh.quantile(0.99):.4f}")
    print(f"homes with PV: {(df.groupby('bldg_id').has_pv.first() == 'Yes').sum()}")
    out = _cache(f"home_dataset_{args.homes}.parquet")
    df.to_parquet(out, index=False)
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
