from __future__ import annotations

"""Seasonality diagnostics and walk-forward evaluation for the spike model.

A single chronological train/val/test split over ERCOT data is misleading:
scarcity pricing is concentrated in summer afternoons, so whichever season lands
in the test window dominates the reported score. These helpers (a) test whether
the spike rate really is season-dependent and (b) score the model out-of-sample
across every season via rolling-origin cross-validation.
"""

from typing import Iterator, Sequence

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import average_precision_score, brier_score_loss

HORIZONS = (1, 2, 3, 4, 5, 6)
INTERVALS_PER_HOUR = 4

# ERCOT's scarcity season is the summer peak; the shoulder months and winter
# behave differently (winter spikes are cold-snap driven, e.g. Uri).
SEASONS = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer", 9: "summer",
    10: "fall", 11: "fall",
}
SEASON_ORDER = ["winter", "spring", "summer", "fall"]


def add_season(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["season"] = out["ts"].dt.month.map(SEASONS)
    return out


def seasonality_report(df: pd.DataFrame, horizon: int = 1) -> dict:
    """Test whether the spike rate depends on season and on hour of day.

    Uses a chi-square test of independence on the 2 x k contingency table of
    (spike, group). A significant result means the base rate is not constant
    across groups, which is what makes a single-season test split unsafe.
    """
    label = f"spike_{horizon}h"
    frame = add_season(df)
    results = {}

    for group in ("season", "hour"):
        table = pd.crosstab(frame[group], frame[label])
        if table.shape[1] < 2:
            results[group] = {"error": "only one class present"}
            continue
        chi2, pval, dof, _ = stats.chi2_contingency(table)
        rate = frame.groupby(group)[label].mean()
        # Cramer's V: effect size, so we don't read significance as importance.
        n = table.to_numpy().sum()
        cramers_v = np.sqrt(chi2 / (n * (min(table.shape) - 1)))
        results[group] = {
            "chi2": chi2,
            "p_value": pval,
            "dof": dof,
            "cramers_v": cramers_v,
            "rate": rate,
        }
    return results


def print_seasonality_report(df: pd.DataFrame, horizon: int = 1) -> None:
    label = f"spike_{horizon}h"
    res = seasonality_report(df, horizon=horizon)
    print(f"\n=== Seasonality of {label} (n={len(df):,}) ===")

    for group in ("season", "hour"):
        r = res[group]
        if "error" in r:
            print(f"{group}: {r['error']}")
            continue
        sig = "YES" if r["p_value"] < 0.05 else "no"
        print(
            f"\n{group}: chi2={r['chi2']:.1f} dof={r['dof']} "
            f"p={r['p_value']:.3e} CramersV={r['cramers_v']:.4f} -> depends on {group}? {sig}"
        )
        rate = r["rate"]
        if group == "season":
            for s in SEASON_ORDER:
                if s in rate.index:
                    print(f"    {s:7s} base rate {rate[s]:.4%}")
        else:
            top = rate.sort_values(ascending=False).head(5)
            print("    peak hours: " + ", ".join(f"{h:02d}h {v:.3%}" for h, v in top.items()))

    frame = add_season(df)
    month_rate = frame.groupby(frame["ts"].dt.month)[label].mean()
    hottest = month_rate.idxmax()
    coldest = month_rate[month_rate > 0].idxmin() if (month_rate > 0).any() else None
    print(f"\n    highest month: {hottest:02d} at {month_rate[hottest]:.4%}")
    if coldest is not None:
        ratio = month_rate[hottest] / month_rate[coldest]
        print(f"    lowest non-zero month: {coldest:02d} at {month_rate[coldest]:.4%} ({ratio:.0f}x spread)")


def walk_forward_splits(
    df: pd.DataFrame,
    n_folds: int = 8,
    initial_frac: float = 0.4,
    max_horizon: int = max(HORIZONS),
) -> Iterator[tuple[pd.DataFrame, pd.DataFrame]]:
    """Rolling-origin splits with an embargo between train and test.

    The label at time ``t`` looks ahead ``max_horizon`` hours, so the final rows
    of any training window are built from prices that fall inside the test
    window. Without an embargo that is direct label leakage across the boundary.
    """
    embargo = max_horizon * INTERVALS_PER_HOUR
    n = len(df)
    start = int(n * initial_frac)
    step = (n - start) // n_folds
    if step <= embargo:
        raise ValueError(f"Folds too small for a {embargo}-interval embargo; reduce n_folds")

    for i in range(n_folds):
        train_end = start + i * step
        test_start = train_end + embargo
        test_end = n if i == n_folds - 1 else train_end + step
        if test_start >= test_end:
            continue
        yield df.iloc[:train_end].copy(), df.iloc[test_start:test_end].copy()


def evaluate_walk_forward(
    full: pd.DataFrame,
    feature_cols: Sequence[str],
    horizons: Sequence[int] = HORIZONS,
    n_folds: int = 8,
    initial_frac: float = 0.4,
    calibrate: bool = False,
    calibration_method: str = "sigmoid",
    refit_full: bool = True,
) -> pd.DataFrame:
    """Fit per fold and collect pooled out-of-sample predictions.

    Returns one row per (test interval, horizon) with ``ts``, ``season``,
    ``horizon``, ``y_true`` and ``y_score``.
    """
    from ml.spike_model import LightGBMSpikeModel

    records = []
    for fold, (train_df, test_df) in enumerate(
        walk_forward_splits(full, n_folds=n_folds, initial_frac=initial_frac)
    ):
        y_train = {h: train_df[f"spike_{h}h"] for h in horizons}
        if sum(y_train[h].sum() for h in horizons) == 0:
            print(f"fold {fold}: no positive training labels, skipped")
            continue

        model = LightGBMSpikeModel(
            horizons=tuple(horizons),
            calibrate=calibrate,
            calibration_method=calibration_method,
            refit_full=refit_full,
        )
        model.fit(train_df[list(feature_cols)], y_train)
        probs = model.predict_many(test_df[list(feature_cols)])

        span = f"{test_df['ts'].iloc[0]:%Y-%m-%d} -> {test_df['ts'].iloc[-1]:%Y-%m-%d}"
        base = test_df[f"spike_{horizons[0]}h"].mean()
        print(f"fold {fold}: train={len(train_df):,} test={len(test_df):,} {span} base={base:.3%}")

        for idx, h in enumerate(horizons):
            records.append(
                pd.DataFrame(
                    {
                        "fold": fold,
                        "ts": test_df["ts"].to_numpy(),
                        "horizon": h,
                        "y_true": test_df[f"spike_{h}h"].to_numpy(),
                        "y_score": probs[:, idx],
                    }
                )
            )

    if not records:
        raise RuntimeError("No usable folds")
    out = pd.concat(records, ignore_index=True)
    return add_season(out)


def _score(group: pd.DataFrame) -> pd.Series:
    y, s = group["y_true"].to_numpy(), group["y_score"].to_numpy()
    base = y.mean()
    if y.sum() == 0:
        return pd.Series({"n": len(y), "base_rate": base, "pr_auc": np.nan, "lift": np.nan, "brier": np.nan})
    pr = average_precision_score(y, s)
    return pd.Series(
        {
            "n": len(y),
            "base_rate": base,
            "pr_auc": pr,
            "lift": pr / base if base > 0 else np.nan,
            "brier": brier_score_loss(y, s),
        }
    )


def macro_scores(oos: pd.DataFrame, horizon: int) -> pd.DataFrame:
    """Per-fold scores for one horizon.

    Metrics must be computed per fold and then averaged, never pooled. Each fold
    is a different model with its own score scale, so a single PR-AUC over the
    concatenated predictions measures how well those scales happen to line up as
    much as it measures skill -- and it comes out materially higher than the
    honest macro average.
    """
    rows = []
    for fold, g in oos[oos["horizon"] == horizon].groupby("fold"):
        y, s = g["y_true"].to_numpy(), g["y_score"].to_numpy()
        if y.sum() == 0:
            continue
        pr = average_precision_score(y, s)
        rows.append(
            {
                "fold": fold,
                "n": len(y),
                "base_rate": y.mean(),
                "pr_auc": pr,
                "lift": pr / y.mean(),
                "brier": brier_score_loss(y, s),
            }
        )
    return pd.DataFrame(rows)


def print_oos_report(oos: pd.DataFrame) -> None:
    """Out-of-sample performance, macro-averaged across folds."""
    print("\n=== Walk-forward performance, macro-averaged across folds ===")
    for h in sorted(oos["horizon"].unique()):
        per = macro_scores(oos, h)
        if per.empty:
            print(f"h={h}h | no fold had positive labels")
            continue
        print(
            f"h={h}h | base={per['base_rate'].mean():.4%} | "
            f"PR-AUC={per['pr_auc'].mean():.4f} (sd {per['pr_auc'].std():.4f}, "
            f"range {per['pr_auc'].min():.4f}-{per['pr_auc'].max():.4f}) | "
            f"lift={per['lift'].mean():.1f}x | Brier={per['brier'].mean():.5f}"
        )

    per1 = macro_scores(oos, 1)
    if not per1.empty:
        print("\n=== Per-fold detail (h=1h) ===")
        folds = oos[oos["horizon"] == 1].groupby("fold")["ts"].agg(["min", "max"])
        for _, r in per1.iterrows():
            span = folds.loc[r["fold"]]
            print(
                f"fold {int(r['fold'])} {span['min']:%Y-%m-%d}->{span['max']:%Y-%m-%d} | "
                f"base={r['base_rate']:.3%} | PR-AUC={r['pr_auc']:.4f} | lift={r['lift']:.1f}x"
            )
        spread = per1["pr_auc"]
        print(
            f"\n    Fold-to-fold PR-AUC ranges {spread.min():.4f}-{spread.max():.4f} "
            f"({spread.max() / max(spread.min(), 1e-9):.1f}x). Any single train/test split "
            "lands somewhere in that range, which is why one split cannot be trusted."
        )

    print("\n=== Pooled predictions sliced by season (h=1h, indicative only) ===")
    print("    Folds are ~3-4 months, so season and fold are confounded; read as")
    print("    a rough regime signal, not a clean per-season measurement.")
    h1 = oos[oos["horizon"] == 1]
    by_s = h1.groupby("season", group_keys=False).apply(_score, include_groups=False)
    for s in SEASON_ORDER:
        if s not in by_s.index:
            continue
        row = by_s.loc[s]
        if np.isnan(row["pr_auc"]):
            print(f"{s:7s} | n={int(row['n']):,} | base={row['base_rate']:.4%} | no positives")
            continue
        print(
            f"{s:7s} | n={int(row['n']):,} | base={row['base_rate']:.4%} | "
            f"PR-AUC={row['pr_auc']:.4f} | lift={row['lift']:.1f}x | Brier={row['brier']:.5f}"
        )
