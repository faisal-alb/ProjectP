from __future__ import annotations

"""Export the replay slices the intelligence service serves from.

The demo runs on a simulated clock over real history, so it is deterministic and
needs no live feeds. This writes two small files next to the model artifacts:

* ``replay/grid.parquet`` -- spike-model feature rows for LZ_AEN around one held-out
  evening, with the realised price alongside for the record.
* ``replay/homes.parquet`` -- baseline-model feature rows for every ResStock home
  over the same calendar day.

The grid day comes from a year the served spike model and price statistics never
trained on (``--train-end`` in their scripts). ResStock has only its 2018 weather
year, so homes use the same calendar day and clock time in 2018, and the baseline
model holds that stretch out of training instead (``--exclude-window``).

Run ``grid`` first: it picks the day and records it in ``replay/manifest.json``,
which ``homes`` then reads.
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd

from ml.features import DEFAULT_FEATURE_COLUMNS, build_feature_frame
from ml.ingest import AUSTIN_LOAD_ZONE

OUT_DIR = Path(__file__).resolve().parent / "artifacts" / "replay"
MANIFEST = OUT_DIR / "manifest.json"
SPIKE_THRESHOLD_MWH = 500.0
HOMES_WEATHER_YEAR = 2018


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pick_evening(
    frame: pd.DataFrame,
    year: int,
    decision_hour: int,
    lead_h: int,
    window_h: int,
    threshold: float = SPIKE_THRESHOLD_MWH,
) -> tuple[pd.Timestamp, float]:
    """The summer evening in ``year`` whose event window cleared highest.

    Chosen on what the price actually did, never on what a model predicted, so
    the pick cannot flatter the model. Returns the decision time and the
    window's peak price.
    """
    summer = frame[(frame["ts"].dt.year == year) & frame["ts"].dt.month.isin([6, 7, 8, 9])]
    best: tuple[pd.Timestamp, float] | None = None
    for day in sorted(summer["ts"].dt.normalize().unique()):
        at = pd.Timestamp(day) + pd.Timedelta(hours=decision_hour)
        start = at + pd.Timedelta(hours=lead_h)
        end = start + pd.Timedelta(hours=window_h)
        window = frame[(frame["ts"] >= start) & (frame["ts"] < end)]["lz_austin_price"]
        if window.empty:
            continue
        peak = float(window.max())
        if peak > threshold and (best is None or peak > best[1]):
            best = (at, peak)
    if best is None:
        raise SystemExit(
            f"No summer evening in {year} cleared above ${threshold:.0f}/MWh in the "
            f"{decision_hour + lead_h}:00 window. Try another --year."
        )
    return best


def export_grid(args: argparse.Namespace) -> None:
    from ml.ingest import build_real_dataset

    raw = build_real_dataset(args.start_year, args.end_year)
    frame = build_feature_frame(raw, spike_threshold_mwh=SPIKE_THRESHOLD_MWH)

    if args.at:
        at = pd.Timestamp(args.at)
        start = at + pd.Timedelta(hours=args.lead)
        window = frame[(frame["ts"] >= start) & (frame["ts"] < start + pd.Timedelta(hours=args.window))]
        peak = float(window["lz_austin_price"].max())
    else:
        at, peak = pick_evening(frame, args.year, args.decision_hour, args.lead, args.window)

    # The replay covers the day before through the day after, so a caller can
    # move the clock around the event without leaving the slice.
    day = at.normalize()
    rows = frame[(frame["ts"] >= day - pd.Timedelta(days=1)) & (frame["ts"] < day + pd.Timedelta(days=2))]
    cols = ["ts", "lz_austin_price"] + [c for c in DEFAULT_FEATURE_COLUMNS if c in rows.columns]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "grid.parquet"
    rows[cols].reset_index(drop=True).to_parquet(path, index=False)

    manifest = {
        "settlement_point": AUSTIN_LOAD_ZONE,
        "default_at": at.isoformat(),
        "lead_h": args.lead,
        "window_h": args.window,
        "window_peak_price_mwh": round(peak, 2),
        "grid_file": path.name,
        "grid_sha256": _sha256(path),
        "grid_span": [str(rows["ts"].min()), str(rows["ts"].max())],
        "homes_weather_year": HOMES_WEATHER_YEAR,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True))
    print(f"Replay evening {at:%Y-%m-%d} decision {at:%H:%M}, window peak ${peak:,.0f}/MWh")
    print(f"Saved {path} ({len(rows):,} rows)")
    window_start = to_homes_time(at + pd.Timedelta(hours=args.lead))
    print(
        "Hold this out of baseline training:\n"
        f"  --exclude-window {(window_start.normalize() - pd.Timedelta(days=7)).date()} "
        f"{(window_start.normalize() + pd.Timedelta(days=2)).date()}"
    )


def to_homes_time(ts: pd.Timestamp) -> pd.Timestamp:
    """Map a local Austin wall-clock time onto ResStock's clock.

    ResStock timestamps are local *standard* time all year (no DST), so a
    summer 7 PM CDT is 6 PM in the file. The year becomes the weather year.
    """
    local = pd.Timestamp(ts).tz_localize("America/Chicago")
    standard = local.tz_convert("Etc/GMT+6").tz_localize(None)
    return standard.replace(year=HOMES_WEATHER_YEAR)


def export_homes(args: argparse.Namespace) -> None:
    from ml.baseline_model import (
        FEATURE_COLUMNS,
        build_home_features,
        degrade_weather_to_forecast,
    )
    from ml.homes import build_home_dataset

    manifest = json.loads(MANIFEST.read_text())
    at = pd.Timestamp(manifest["default_at"])
    raw = build_home_dataset(n_homes=args.homes)
    # Same pseudo-forecast weather the model was trained on.
    raw = degrade_weather_to_forecast(raw)
    df = build_home_features(raw, horizon_h=args.horizon)

    day = to_homes_time(at).normalize()
    rows = df[(df["ts"] >= day) & (df["ts"] < day + pd.Timedelta(days=1))]
    cols = ["bldg_id", "ts", "net_kwh"] + list(FEATURE_COLUMNS)
    path = OUT_DIR / "homes.parquet"
    rows[cols].sort_values(["bldg_id", "ts"]).reset_index(drop=True).to_parquet(path, index=False)

    manifest.update(
        {
            "homes_file": path.name,
            "homes_sha256": _sha256(path),
            "homes_horizon_h": args.horizon,
            "homes_count": int(rows["bldg_id"].nunique()),
            "homes_day": str(day.date()),
        }
    )
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True))
    print(f"Saved {path} ({rows['bldg_id'].nunique()} homes, {len(rows):,} rows, {day.date()})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export replay slices for the intelligence service.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    grid = sub.add_parser("grid", help="pick the replay evening and export spike features")
    grid.add_argument("--start-year", type=int, default=2021)
    grid.add_argument("--end-year", type=int, default=2024)
    grid.add_argument("--year", type=int, default=2024, help="pick the evening from this year")
    grid.add_argument("--at", help="use this decision time instead of picking one")
    grid.add_argument("--decision-hour", type=int, default=17)
    grid.add_argument("--lead", type=int, default=2, help="hours from decision to window start")
    grid.add_argument("--window", type=int, default=1, help="event window length in hours")
    grid.set_defaults(func=export_grid)

    homes = sub.add_parser("homes", help="export baseline features for the replay day")
    homes.add_argument("--homes", type=int, default=50)
    homes.add_argument("--horizon", type=int, default=3, help="must match the baseline model")
    homes.set_defaults(func=export_homes)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
