from __future__ import annotations

"""Household load ingestion from NREL ResStock, for the baseline model.

The baseline model estimates what a home *would* have drawn absent an event --
the counterfactual that settlement is measured against. Training it on the
project's own simulator would mean learning the simulator's load formula, so
this pulls real, physics-calibrated profiles instead. See
``docs/home-models-plan.md`` §2.2.

Source: NREL End-Use Load Profiles, public on the OEDI data lake (no
credentials). Travis County, TX -- the same geography as the ``LZ_AEN`` prices
in ``ml/ingest.py``. Two weather years are available and both are used by
default:

======== ======== ============ ==========================================
release  weather  Travis homes notes
======== ======== ============ ==========================================
amy2018  2018     1,961        columns unsuffixed, metadata/baseline.parquet
amy2012  2012     1,949        columns suffixed ``..kwh``, different
                               metadata path, ``in.sqft..ft2``
======== ======== ============ ==========================================

Only 6 building ids appear in both releases, so these are effectively two
independent samples of the county under two different weather years. That is
exactly what the baseline model needs: with a single year, every walk-forward
test fold lands in a season the model never saw in training, which is what
drove p10 coverage to swing between 8% and 19%.

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
_BASE = "nrel-pds-building-stock/end-use-load-profiles-for-us-building-stock"

RELEASES = {
    "amy2018": {
        "root": f"{_BASE}/2024/resstock_amy2018_release_2",
        "metadata": "metadata/baseline.parquet",
        "suffix": "",
        "sqft": "in.sqft",
        "year": 2018,
    },
    "amy2012": {
        "root": f"{_BASE}/2025/resstock_amy2012_release_1",
        "metadata": "metadata_and_annual_results/national/full/parquet/upgrade0.parquet",
        "suffix": "..kwh",
        "sqft": "in.sqft..ft2",
        "year": 2012,
    },
}
# amy2018 only by default. amy2012 is wired up and usable via --releases, but
# it is a different sample of homes (6 ids overlap), only ~20% of its stock has
# published timeseries files, and it never demonstrated a coverage improvement
# worth the added schema divergence.
DEFAULT_RELEASES = ("amy2018",)

COUNTY_NAME = "Travis"
STATE = "TX"
CST_OFFSET_HOURS = -6

CACHE_DIR = Path(__file__).resolve().parent / "data_cache"

# Static characteristics; these become model features.
META_BASE = [
    "in.state",
    "in.county_name",
    "in.occupants",
    "in.bedrooms",
    "in.vintage",
    "in.hvac_cooling_type",
    "in.has_pv",
]

# End uses worth carrying. ``net`` is authoritative (verified equal to
# total + pv, where ResStock signs PV negative) and is the model target.
SERIES_BASE = {
    "out.electricity.net.energy_consumption": "net_kwh",
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


def _series_columns(release: str) -> dict[str, str]:
    suffix = RELEASES[release]["suffix"]
    return {f"{k}{suffix}": v for k, v in SERIES_BASE.items()}


def fetch_home_metadata(release: str = "amy2018", use_cache: bool = True) -> pd.DataFrame:
    """Static characteristics for every Travis County home in a release."""
    cache = _cache(f"resstock_{release}_{COUNTY_NAME.lower()}_metadata.parquet")
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    import pyarrow.parquet as pq

    cfg = RELEASES[release]
    print(f"[resstock:{release}] fetching metadata for {COUNTY_NAME} County, {STATE}...")
    fs = _fs()
    # bldg_id is the pandas index column: it must be requested explicitly or the
    # frame comes back with a positional RangeIndex whose values look like ids
    # but are not.
    cols = ["bldg_id"] + META_BASE + [cfg["sqft"]]
    with fs.open(f"{BUCKET}/{cfg['root']}/{cfg['metadata']}") as handle:
        meta = pq.read_table(handle, columns=cols).to_pandas()

    meta = meta.rename(columns={cfg["sqft"]: "in.sqft"})
    meta = meta[
        (meta["in.state"] == STATE)
        & (meta["in.county_name"].str.contains(COUNTY_NAME, na=False))
    ].copy()
    meta.index.name = "bldg_id"
    meta.to_parquet(cache)
    print(f"[resstock:{release}] {len(meta):,} homes in {COUNTY_NAME} County")
    return meta


def fetch_home_timeseries(
    bldg_ids: Sequence[int], release: str = "amy2018", use_cache: bool = True
) -> pd.DataFrame:
    """Per-home 15-minute load for the given buildings, long format."""
    cache = _cache(f"resstock_{release}_{COUNTY_NAME.lower()}_ts_{len(bldg_ids)}.parquet")
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    import pyarrow.parquet as pq

    cfg = RELEASES[release]
    mapping = _series_columns(release)
    fs = _fs()
    frames = []
    for i, bldg_id in enumerate(bldg_ids, 1):
        key = (
            f"{BUCKET}/{cfg['root']}/timeseries_individual_buildings/by_state/"
            f"upgrade=0/state={STATE}/{bldg_id}-0.parquet"
        )
        with fs.open(key) as handle:
            df = pq.read_table(handle, columns=["timestamp"] + list(mapping)).to_pandas()
        df = df.rename(columns=mapping)
        df["bldg_id"] = bldg_id
        frames.append(df)
        if i % 10 == 0 or i == len(bldg_ids):
            print(f"[resstock:{release}] {i}/{len(bldg_ids)} homes")

    out = pd.concat(frames, ignore_index=True)
    out["ts"] = pd.to_datetime(out["timestamp"]) - pd.Timedelta(minutes=15)
    out = out.drop(columns=["timestamp"])
    out = out[["bldg_id", "ts"] + list(SERIES_BASE.values())]
    out = out.sort_values(["bldg_id", "ts"]).reset_index(drop=True)
    out.to_parquet(cache, index=False)
    return out


def fetch_weather_local_standard(year: int, use_cache: bool = True) -> pd.DataFrame:
    """Austin weather for one ResStock year, on ResStock's clock.

    Fetched in UTC and shifted by a fixed -6h. ResStock has no DST, so a
    DST-aware zone would misalign the series by an hour for half the year.
    """
    cache = _cache(f"resstock_weather_{year}.parquet")
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    from ml.ingest import AUSTIN_LAT, AUSTIN_LON, OPEN_METEO_ARCHIVE, _open_meteo

    print(f"[open-meteo] fetching {year} weather actuals (UTC -> CST)...")
    payload = _open_meteo(
        OPEN_METEO_ARCHIVE,
        {
            "latitude": AUSTIN_LAT,
            "longitude": AUSTIN_LON,
            "start_date": f"{year - 1}-12-31",
            "end_date": f"{year}-12-31",
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


def available_bldg_ids(release: str = "amy2018", use_cache: bool = True) -> set[int]:
    """Building ids that actually have a published timeseries file.

    Not every home in the metadata has one: the amy2012 release publishes
    individual building files for roughly 20% of the stock, so sampling from
    metadata alone yields mostly 404s. The state prefix is listed once and
    cached rather than probing each candidate id.
    """
    cache = _cache(f"resstock_{release}_{STATE}_available_ids.json")
    if use_cache and cache.exists():
        import json

        return set(json.loads(cache.read_text()))

    import json

    cfg = RELEASES[release]
    prefix = (
        f"{BUCKET}/{cfg['root']}/timeseries_individual_buildings/by_state/"
        f"upgrade=0/state={STATE}/"
    )
    print(f"[resstock:{release}] listing available {STATE} timeseries files...")
    keys = _fs().ls(prefix, detail=False)
    ids = set()
    for k in keys:
        name = k.rsplit("/", 1)[-1]
        if name.endswith("-0.parquet"):
            try:
                ids.add(int(name.split("-")[0]))
            except ValueError:
                continue
    cache.write_text(json.dumps(sorted(ids)))
    print(f"[resstock:{release}] {len(ids):,} {STATE} buildings have timeseries files")
    return ids


def _one_release(release: str, n_homes: int, seed: int, use_cache: bool) -> pd.DataFrame:
    meta = fetch_home_metadata(release, use_cache=use_cache)
    have = available_bldg_ids(release, use_cache=use_cache)
    meta = meta[meta.index.isin(have)]
    if len(meta) < n_homes:
        print(f"[resstock:{release}] only {len(meta)} homes have timeseries; using all")
    sample = meta.sample(n=min(n_homes, len(meta)), random_state=seed)
    ts = fetch_home_timeseries(list(sample.index), release, use_cache=use_cache)

    weather = fetch_weather_local_standard(RELEASES[release]["year"], use_cache=use_cache)
    df = ts.merge(weather.sort_values("ts"), on="ts", how="left").sort_values(["bldg_id", "ts"])
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
    df["release"] = release
    df["weather_year"] = RELEASES[release]["year"]
    return df


def build_home_dataset(
    n_homes: int = 50,
    seed: int = 42,
    releases: Sequence[str] = DEFAULT_RELEASES,
    use_cache: bool = True,
) -> pd.DataFrame:
    """Per-home load joined to weather and characteristics, across releases.

    ``n_homes`` is per release. Building ids barely overlap between releases, so
    ids are namespaced to keep per-home lag features from splicing a 2012 home
    onto an unrelated 2018 home that happens to share an id.
    """
    frames = [_one_release(r, n_homes, seed, use_cache) for r in releases]
    df = pd.concat(frames, ignore_index=True)
    df["bldg_id"] = df["release"] + ":" + df["bldg_id"].astype(str)
    return df.sort_values(["bldg_id", "ts"]).reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest ResStock household load.")
    parser.add_argument("--homes", type=int, default=50, help="per release")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--releases", nargs="+", default=list(DEFAULT_RELEASES))
    parser.add_argument("--no-cache", action="store_true")
    args = parser.parse_args()

    df = build_home_dataset(
        n_homes=args.homes, seed=args.seed, releases=args.releases, use_cache=not args.no_cache
    )
    print(f"\nrows={len(df):,}  homes={df.bldg_id.nunique()}  releases={args.releases}")
    for year, g in df.groupby("weather_year"):
        print(f"  {year}: {len(g):,} rows, {g.bldg_id.nunique()} homes, "
              f"{g.ts.min().date()} -> {g.ts.max().date()}, "
              f"mean {g.net_kwh.mean():.4f} kWh/interval, "
              f"temp {g.temp_f.min():.0f}-{g.temp_f.max():.0f} F")
    out = _cache(f"home_dataset_{'_'.join(args.releases)}_{args.homes}.parquet")
    df.to_parquet(out, index=False)
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
