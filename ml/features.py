from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd


def add_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add time-based columns that match the orchestration spec."""
    out = df.copy()
    out["hour"] = out["ts"].dt.hour
    out["day_of_week"] = out["ts"].dt.dayofweek
    out["month"] = out["ts"].dt.month
    out["holiday_flag"] = out["ts"].dt.date.map(
        lambda d: int(pd.Timestamp(d).dayofweek >= 5)
    )
    return out


def add_price_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create lag and rolling price features used by the spike model."""
    out = df.sort_values("ts").copy()
    out["price_lag_1"] = out["lz_austin_price"].shift(1)
    out["price_lag_4"] = out["lz_austin_price"].shift(4)
    out["price_lag_96"] = out["lz_austin_price"].shift(96)
    out["rolling_price_max_24h"] = (
        out["lz_austin_price"].shift(1).rolling(window=96, min_periods=1).max()
    )
    return out


def build_feature_frame(
    df: pd.DataFrame,
    horizons: Sequence[int] = (1, 2, 3, 4, 5, 6),
    spike_threshold_mwh: float = 500.0,
) -> pd.DataFrame:
    """Create a feature table and add horizon-specific spike labels.

    This is intentionally lightweight and designed to be compatible with the
    orchestration spec: the feature row reflects data available at time t and the
    target is defined relative to the future price window.
    """
    out = df.copy().sort_values("ts").reset_index(drop=True)
    out = add_calendar_features(out)
    out = add_price_features(out)

    label_cols = []
    for horizon in horizons:
        step_count = int((horizon * 60) / 15)
        # Max price over the forward window (t, t + horizon], not the single
        # price at t + horizon: the spec defines a spike as the price exceeding
        # the threshold *within* the horizon.
        future_max = (
            out["lz_austin_price"]
            .shift(-step_count)
            .rolling(window=step_count, min_periods=step_count)
            .max()
        )
        col = f"spike_{horizon}h"
        out[col] = (future_max > spike_threshold_mwh).astype("float")
        out.loc[future_max.isna(), col] = float("nan")
        label_cols.append(col)

    # The final `max(horizons)` of rows have no complete forward window.
    out = out.dropna(subset=label_cols).reset_index(drop=True)
    out[label_cols] = out[label_cols].astype(int)

    return out


DEFAULT_FEATURE_COLUMNS = [
    "hour",
    "day_of_week",
    "month",
    "holiday_flag",
    "temp_f",
    "cloud_cover",
    "forecast_temp_1h",
    "forecast_temp_2h",
    "forecast_temp_3h",
    "forecast_temp_4h",
    "forecast_temp_5h",
    "forecast_temp_6h",
    "load_forecast_1h",
    "load_forecast_2h",
    "load_forecast_3h",
    "load_forecast_4h",
    "load_forecast_5h",
    "load_forecast_6h",
    "outage_mw",
    "price_lag_1",
    "price_lag_4",
    "price_lag_96",
    "rolling_price_max_24h",
]
