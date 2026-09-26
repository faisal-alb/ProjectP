from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss

from ml.evaluate import (
    INTERVALS_PER_HOUR,
    evaluate_walk_forward,
    print_oos_report,
    print_seasonality_report,
)
from ml.features import DEFAULT_FEATURE_COLUMNS, build_feature_frame
from ml.spike_model import LightGBMSpikeModel

HORIZONS = (1, 2, 3, 4, 5, 6)
SPIKE_THRESHOLD_MWH = 500.0


def generate_synthetic_grid_data(days: int = 180, step_minutes: int = 15) -> pd.DataFrame:
    """Create a synthetic ERCOT-like dataset for offline tests.

    This is not production data. It exists so the training loop can run without
    network access; use ``--source real`` for anything you intend to trust. The
    scarcity spikes and forecast error below are deliberately crude imitations of
    the real distributions.
    """
    rng = np.random.default_rng(42)
    start = pd.Timestamp("2024-01-01 00:00:00")
    intervals = int((days * 24 * 60) / step_minutes)
    ts = pd.date_range(start=start, periods=intervals, freq=f"{step_minutes}min")

    hours = ts.hour.values
    doy = ts.dayofyear.values
    load = 50000 + 12000 * np.sin((hours - 16) * np.pi / 12) + 4000 * np.cos(doy / 10)
    temp = 70 + 18 * np.sin((hours - 15) * np.pi / 12) + 5 * np.cos(doy / 12)

    price = 35 + 0.45 * load / 1000 + 0.8 * np.maximum(temp - 80, 0) + rng.normal(0, 10, size=len(ts))

    # ERCOT scarcity pricing is rare and extreme rather than a broad afternoon
    # lift: roughly 0.3% of intervals, concentrated in the late-afternoon peak,
    # clearing far above the $500/MWh spike threshold.
    peak = (hours >= 15) & (hours <= 20)
    scarcity = (rng.random(len(ts)) < 0.012) & peak
    price[scarcity] += rng.uniform(500, 4500, size=scarcity.sum())
    price = np.clip(price, -50, 5000)

    outage = np.zeros(len(ts))
    evening = (hours >= 17) & (hours <= 19)
    outage[evening] = 3500 + rng.normal(0, 600, size=evening.sum())

    df = pd.DataFrame(
        {
            "ts": ts,
            "lz_austin_price": price,
            "outage_mw": outage,
            "temp_f": temp,
            "cloud_cover": np.clip(40 + 30 * np.sin(doy / 12), 0, 100),
        }
    )

    # Forecasts must carry forecast error, and error must grow with lead time.
    # The previous version set forecast_temp_Nh = temp + constant, which made the
    # "forecasts" perfect oracles and leaked the target.
    steps_per_hour = int(60 / step_minutes)
    for h in HORIZONS:
        future_temp = pd.Series(temp).shift(-h * steps_per_hour)
        df[f"forecast_temp_{h}h"] = future_temp + rng.normal(0, 1.2 * np.sqrt(h), size=len(ts))
        future_load = pd.Series(load).shift(-h * steps_per_hour)
        df[f"load_forecast_{h}h"] = future_load + rng.normal(0, 600 * np.sqrt(h), size=len(ts))

    return df.dropna().reset_index(drop=True)


def load_real_data(
    start_year: int, end_year: int, lead: str = "day_ahead", use_cache: bool = True
) -> pd.DataFrame:
    """Load real ERCOT prices and Open-Meteo weather via the ingestion module."""
    from ml.ingest import build_real_dataset

    return build_real_dataset(
        start_year=start_year, end_year=end_year, lead=lead, use_cache=use_cache
    )


def split_train_validation_test(df: pd.DataFrame, val_frac: float = 0.15, test_frac: float = 0.15):
    """Chronological split with an embargo at each boundary.

    Labels look ahead up to ``max(HORIZONS)`` hours, so without the embargo the
    tail of each split is labelled from prices belonging to the next split.

    Note this split is seasonally biased on a short history: the test window is
    whatever season happens to fall last. Prefer the walk-forward evaluation in
    ``ml.evaluate`` for a trustworthy estimate.
    """
    embargo = max(HORIZONS) * INTERVALS_PER_HOUR
    n = len(df)
    val_cut = int(n * (1 - val_frac - test_frac))
    test_cut = int(n * (1 - test_frac))
    train = df.iloc[: val_cut - embargo].copy()
    val = df.iloc[val_cut : test_cut - embargo].copy()
    test = df.iloc[test_cut:].copy()
    return train, val, test


def report(split_name: str, y_map: dict, probs: np.ndarray, horizons=HORIZONS) -> None:
    for idx, horizon in enumerate(horizons):
        y_true = y_map[horizon].to_numpy()
        y_score = probs[:, idx]
        base_rate = y_true.mean()
        if y_true.sum() == 0:
            print(f"{split_name} h={horizon}h | no positive labels -- metrics undefined")
            continue
        print(
            f"{split_name} h={horizon}h | base={base_rate:.4%} | "
            f"PR-AUC={average_precision_score(y_true, y_score):.4f} | "
            f"lift={average_precision_score(y_true, y_score) / base_rate:.1f}x | "
            f"Brier={brier_score_loss(y_true, y_score):.5f}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the spike classifier.")
    parser.add_argument(
        "--source",
        choices=("real", "synthetic"),
        default="real",
        help="real = ERCOT + Open-Meteo (default); synthetic = offline stub data",
    )
    parser.add_argument("--start-year", type=int, default=2021)
    parser.add_argument("--end-year", type=int, default=2024)
    parser.add_argument(
        "--lead",
        choices=("day_ahead", "short"),
        default="day_ahead",
        help="weather forecast lead time; day_ahead is the conservative bound",
    )
    parser.add_argument(
        "--eval",
        choices=("walk-forward", "holdout"),
        default="walk-forward",
        help="walk-forward covers every season; holdout is the old single split",
    )
    parser.add_argument("--folds", type=int, default=8)
    parser.add_argument("--days", type=int, default=180, help="synthetic only")
    parser.add_argument("--threshold", type=float, default=SPIKE_THRESHOLD_MWH)
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--skip-seasonality", action="store_true")
    parser.add_argument(
        "--exclude-regimes",
        action="store_true",
        help=(
            "drop Winter Storm Uri (see REGIME_EXCLUSIONS). Off by default: Uri is "
            "train-only under this split and excluding it cost ~9%% relative PR-AUC. "
            "Recommended for the price statistics, not for this classifier."
        ),
    )
    args = parser.parse_args()

    if args.source == "real":
        raw = load_real_data(
            args.start_year, args.end_year, lead=args.lead, use_cache=not args.no_cache
        )
    else:
        raw = generate_synthetic_grid_data(days=args.days)

    # Lags and labels are computed on the contiguous series, then excluded
    # regimes are removed -- never the other way round.
    full = build_feature_frame(raw, horizons=HORIZONS, spike_threshold_mwh=args.threshold)
    if args.source == "real" and args.exclude_regimes:
        from ml.ingest import drop_excluded_regimes

        before = len(full)
        full = drop_excluded_regimes(full, horizons=HORIZONS)
        print(f"[regime] {before:,} -> {len(full):,} rows after exclusions")

    print(f"Source={args.source}  rows={len(full):,}  span={full['ts'].min()} -> {full['ts'].max()}")
    if args.source == "real":
        print(f"Forecast lead: {args.lead}")

    feature_cols = [c for c in DEFAULT_FEATURE_COLUMNS if c in full.columns]
    dropped = [c for c in DEFAULT_FEATURE_COLUMNS if c not in full.columns]
    print(f"Features: {len(feature_cols)} used" + (f", unavailable: {dropped}" if dropped else ""))

    if sum(full[f"spike_{h}h"].sum() for h in HORIZONS) == 0:
        raise SystemExit(
            f"No positive labels at threshold ${args.threshold}/MWh -- "
            "the model would train on an all-zero target. Lower --threshold."
        )

    if not args.skip_seasonality:
        print_seasonality_report(full, horizon=1)

    if args.eval == "walk-forward":
        print(f"\n=== Walk-forward evaluation, {args.folds} folds ===")
        oos = evaluate_walk_forward(full, feature_cols, horizons=HORIZONS, n_folds=args.folds)
        print_oos_report(oos)
    else:
        train_df, val_df, test_df = split_train_validation_test(full)
        y_train = {h: train_df[f"spike_{h}h"] for h in HORIZONS}
        holdout = LightGBMSpikeModel(horizons=HORIZONS)
        holdout.fit(train_df[feature_cols], y_train)
        print()
        report("val ", {h: val_df[f"spike_{h}h"] for h in HORIZONS}, holdout.predict_many(val_df[feature_cols]))
        print()
        report("test", {h: test_df[f"spike_{h}h"] for h in HORIZONS}, holdout.predict_many(test_df[feature_cols]))

    # Ship a model fit on all available history, evaluated by the pass above.
    print("\nFitting final model on full history...")
    model = LightGBMSpikeModel(horizons=HORIZONS)
    model.fit(full[feature_cols], {h: full[f"spike_{h}h"] for h in HORIZONS})

    out_dir = Path(__file__).resolve().parent / "artifacts"
    out_dir.mkdir(exist_ok=True)
    model_path = out_dir / "spike_model.pkl"
    with open(model_path, "wb") as handle:
        import pickle

        pickle.dump(model, handle)
    print(f"Saved model to {model_path}")


if __name__ == "__main__":
    main()
