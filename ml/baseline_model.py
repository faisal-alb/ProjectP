from __future__ import annotations

"""Per-home baseline model: the counterfactual settlement is measured against.

One quantile regressor serves both roles in the orchestration spec, which
treats them as separate models:

* **p50** -> ``baseline_kwh``, the counterfactual used in
  ``delivered_kwh = sum(baseline_kwh - actual_grid_kwh)``
* **p10** -> ``committed_kwh``, the conservative sizing estimate

Deriving both from one published number means a generous sizing forecast cannot
be paired with a stingy settlement baseline. See ``docs/09_HOME_MODELS_PLAN.md``.

Target is **net grid draw** (``total + pv``; ResStock signs PV negative), so
solar export shows up as negative draw exactly as the meter would record it.
"""

import argparse
import sys
from pathlib import Path
from typing import Sequence

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import lightgbm as lgb
import numpy as np
import pandas as pd

INTERVALS_PER_HOUR = 4
QUANTILES = (0.1, 0.5)

STATIC_FEATURES = ["sqft", "occupants", "bedrooms", "has_pv_flag"]
WEATHER_FEATURES = ["temp_f", "cloud_cover", "humidity"]
CALENDAR_FEATURES = ["hour", "day_of_week", "month", "is_weekend"]


# Measured Open-Meteo day-ahead error for Austin (ml/ingest.py, 2024 sample):
# 2.29 F MAE against actuals. For a Gaussian, MAE = sd * sqrt(2/pi), so the
# equivalent sd is 2.29 / 0.7979.
FORECAST_TEMP_MAE_F = 2.29
FORECAST_CLOUD_MAE_PCT = 12.0


def degrade_weather_to_forecast(
    df: pd.DataFrame, seed: int = 0, temp_mae: float = FORECAST_TEMP_MAE_F
) -> pd.DataFrame:
    """Turn weather actuals into realistic pseudo-forecasts.

    ResStock is a 2018 dataset and Open-Meteo's forecast archive starts in 2021,
    so genuine as-issued forecasts are unavailable for this period. Training on
    actuals would hand the model perfect foresight of the weather -- the same
    oracle-feature mistake that made the spike model's original synthetic data
    degenerate. Instead, inject noise calibrated to the day-ahead forecast error
    actually measured for this location.
    """
    rng = np.random.default_rng(seed)
    out = df.copy()
    sd_temp = temp_mae / np.sqrt(2 / np.pi)
    sd_cloud = FORECAST_CLOUD_MAE_PCT / np.sqrt(2 / np.pi)
    out["temp_f"] = out["temp_f"] + rng.normal(0, sd_temp, len(out))
    out["cloud_cover"] = np.clip(
        out["cloud_cover"] + rng.normal(0, sd_cloud, len(out)), 0, 100
    )
    return out


def build_home_features(df: pd.DataFrame, horizon_h: int = 1) -> pd.DataFrame:
    """Features for predicting net draw at ``t``, decided at ``t - horizon_h``.

    Every lag is at least ``horizon_h`` back, so nothing here would be unknown
    to a caller standing at the decision time. Lags are computed per home --
    a global shift would bleed one household's load into the next.
    """
    out = df.sort_values(["bldg_id", "ts"]).copy()
    out["net_kwh"] = out["total_kwh"] + out["pv_kwh"]
    out["has_pv_flag"] = (out["has_pv"] == "Yes").astype(int)

    # ResStock ships these as strings (and pyarrow-backed ints), with bucket
    # labels like "10+" for the top category. Strip to digits and coerce.
    for col in ("sqft", "occupants", "bedrooms"):
        out[col] = pd.to_numeric(
            out[col].astype(str).str.replace(r"[^0-9.]", "", regex=True),
            errors="coerce",
        ).astype("float64")

    out["hour"] = out["ts"].dt.hour
    out["day_of_week"] = out["ts"].dt.dayofweek
    out["month"] = out["ts"].dt.month
    out["is_weekend"] = (out["day_of_week"] >= 5).astype(int)

    lead = horizon_h * INTERVALS_PER_HOUR
    g = out.groupby("bldg_id")["net_kwh"]

    # Most recent reading available at decision time, and an hour before that.
    out["lag_lead"] = g.shift(lead)
    out["lag_lead_1h"] = g.shift(lead + INTERVALS_PER_HOUR)
    # Same interval yesterday and last week: the naive baselines to beat.
    out["lag_1d"] = g.shift(96)
    out["lag_7d"] = g.shift(672)
    # Recent level and volatility, as of decision time.
    out["roll_24h_mean"] = g.shift(lead).rolling(96, min_periods=24).mean().reset_index(0, drop=True)
    out["roll_24h_max"] = g.shift(lead).rolling(96, min_periods=24).max().reset_index(0, drop=True)
    # Same hour-of-day average over the past week, the classic DR baseline.
    out["same_hour_7d"] = (
        out.groupby(["bldg_id", "hour"])["net_kwh"].shift(1).rolling(7, min_periods=3).mean()
        .reset_index(0, drop=True)
    )

    return out.dropna(subset=["lag_7d", "roll_24h_mean"]).reset_index(drop=True)


FEATURE_COLUMNS = (
    CALENDAR_FEATURES
    + WEATHER_FEATURES
    + STATIC_FEATURES
    + ["lag_lead", "lag_lead_1h", "lag_1d", "lag_7d", "roll_24h_mean", "roll_24h_max", "same_hour_7d"]
)


class BaselineQuantileModel:
    """LightGBM quantile regressors, one booster per quantile."""

    def __init__(self, quantiles: Sequence[float] = QUANTILES, params: dict | None = None):
        self.quantiles = tuple(quantiles)
        self.params = params or {
            "objective": "quantile",
            "learning_rate": 0.05,
            "num_leaves": 63,
            "min_data_in_leaf": 100,
            "feature_fraction": 0.9,
            "bagging_fraction": 0.8,
            "bagging_freq": 1,
            "verbosity": -1,
            "n_estimators": 300,
            "random_state": 42,
        }
        self.models: dict[float, lgb.LGBMRegressor] = {}
        self.feature_names: list[str] = []

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "BaselineQuantileModel":
        self.feature_names = list(X.columns)
        for q in self.quantiles:
            model = lgb.LGBMRegressor(**{**self.params, "alpha": q})
            model.fit(X, y)
            self.models[q] = model
        return self

    def predict(self, X: pd.DataFrame) -> dict[float, np.ndarray]:
        missing = [c for c in self.feature_names if c not in X.columns]
        if missing:
            raise KeyError(f"Input is missing training features: {missing}")
        return {q: m.predict(X[self.feature_names]) for q, m in self.models.items()}


def time_split(df: pd.DataFrame, n_folds: int = 4, initial_frac: float = 0.5):
    """Rolling-origin splits on the *timestamp*, not on row position.

    The frame is long (one row per home per interval), so splitting by row would
    cut through a single timestamp and put the same moment on both sides.
    """
    stamps = np.sort(df["ts"].unique())
    start = int(len(stamps) * initial_frac)
    step = (len(stamps) - start) // n_folds
    for i in range(n_folds):
        train_end = stamps[start + i * step]
        test_end = stamps[-1] if i == n_folds - 1 else stamps[start + (i + 1) * step]
        train = df[df["ts"] < train_end]
        test = df[(df["ts"] >= train_end) & (df["ts"] <= test_end)]
        if len(test) == 0:
            continue
        yield train, test


def pinball_loss(y: np.ndarray, pred: np.ndarray, q: float) -> float:
    d = y - pred
    return float(np.mean(np.maximum(q * d, (q - 1) * d)))


def evaluate(df: pd.DataFrame, horizon_h: int = 1, n_folds: int = 4) -> pd.DataFrame:
    """Walk-forward evaluation, reported per fold and macro-averaged."""
    rows = []
    for fold, (train, test) in enumerate(time_split(df, n_folds=n_folds)):
        model = BaselineQuantileModel().fit(train[FEATURE_COLUMNS], train["net_kwh"])
        preds = model.predict(test[FEATURE_COLUMNS])
        y = test["net_kwh"].to_numpy()

        p50, p10 = preds[0.5], preds[0.1]
        naive = test["lag_1d"].to_numpy()          # same interval yesterday
        seven = test["same_hour_7d"].to_numpy()    # classic DR baseline

        rows.append(
            {
                "fold": fold,
                "n": len(test),
                "span": f"{test.ts.min():%Y-%m-%d}->{test.ts.max():%Y-%m-%d}",
                "mae_p50": float(np.mean(np.abs(y - p50))),
                "mae_naive_1d": float(np.mean(np.abs(y - naive))),
                "mae_same_hour_7d": float(np.nanmean(np.abs(y - seven))),
                "pinball_p50": pinball_loss(y, p50, 0.5),
                "pinball_p10": pinball_loss(y, p10, 0.1),
                "p10_coverage": float(np.mean(y < p10)),
                "mean_actual": float(np.mean(y)),
            }
        )
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the per-home baseline model.")
    parser.add_argument("--homes", type=int, default=50)
    parser.add_argument("--horizon", type=int, default=1, help="lead time in hours")
    parser.add_argument("--folds", type=int, default=4)
    parser.add_argument(
        "--perfect-weather",
        action="store_true",
        help="use weather actuals as-is (optimistic; deployment sees forecasts)",
    )
    args = parser.parse_args()

    from ml.homes import build_home_dataset

    raw = build_home_dataset(n_homes=args.homes)
    if not args.perfect_weather:
        raw = degrade_weather_to_forecast(raw)
        print(f"weather degraded to pseudo-forecast ({FORECAST_TEMP_MAE_F} F MAE)")
    df = build_home_features(raw, horizon_h=args.horizon)
    print(f"rows={len(df):,}  homes={df.bldg_id.nunique()}  horizon={args.horizon}h")
    print(f"target net_kwh: mean={df.net_kwh.mean():.4f}  p50={df.net_kwh.median():.4f}")

    res = evaluate(df, horizon_h=args.horizon, n_folds=args.folds)
    print("\n=== Walk-forward, per fold ===")
    for _, r in res.iterrows():
        print(
            f"fold {int(r.fold)} {r.span} n={int(r.n):,} | "
            f"MAE p50={r.mae_p50:.4f} vs naive-1d={r.mae_naive_1d:.4f} "
            f"vs same-hour-7d={r.mae_same_hour_7d:.4f} | p10 coverage={r.p10_coverage:.1%}"
        )
    print("\n=== Macro-averaged ===")
    m = res.mean(numeric_only=True)
    imp_naive = 100 * (1 - m.mae_p50 / m.mae_naive_1d)
    imp_seven = 100 * (1 - m.mae_p50 / m.mae_same_hour_7d)
    print(f"MAE p50            {m.mae_p50:.4f} kWh/interval  ({m.mae_p50*4:.3f} kW)")
    print(f"MAE naive 1-day    {m.mae_naive_1d:.4f}  -> model is {imp_naive:+.1f}% better")
    print(f"MAE same-hour 7d   {m.mae_same_hour_7d:.4f}  -> model is {imp_seven:+.1f}% better")
    print(f"pinball p50        {m.pinball_p50:.4f}")
    print(f"pinball p10        {m.pinball_p10:.4f}")
    print(f"p10 coverage       {m.p10_coverage:.1%}  (target 10%)")
    print(f"mean actual        {m.mean_actual:.4f} kWh/interval")


if __name__ == "__main__":
    main()
