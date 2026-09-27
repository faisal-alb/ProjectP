from __future__ import annotations

"""Fair-value pricing for flexibility contracts.

Implements §3.3 of ``docs/model-orchestration.md``:

    fair_value   = P(spike) x E[price|spike] + (1 - P(spike)) x E[price|no spike]
    risk_buffer  = buffer_k x (price_p50 - price_p10)
    locked_price = fair_value - risk_buffer - aggregator_fee
    collateral   = locked_price x sum(committed_kwh)

Deliberately **not** a learned model. ``E[price|spike]`` would be fit on ~1,720
positive intervals across four years, so a model would mostly memorise a handful
of scarcity events. Stratified empirical statistics give the same output
contract, need no training, and every number is traceable to a counterparty --
which matters when the price ends up in an on-chain commitment.

Winter Storm Uri is excluded here specifically. Its near-cap prices are not
reachable under current ERCOT rules (yearly max steps 9,902 -> 5,991 -> 6,018 ->
4,981 after the post-Uri cap reduction), and including it inflates
``E[price|spike]`` from ~$1,033 to ~$2,505/MWh. At the inflated figure every
event threshold loses money. The spike *classifier* keeps Uri; see
``REGIME_EXCLUSIONS`` in ``ml/ingest.py``.
"""

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd

MWH_TO_KWH = 1000.0

SEASONS = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer", 9: "summer",
    10: "fall", 11: "fall",
}
# Hour blocks rather than raw hours: at a 1.2% base rate, season x hour leaves
# 28 of 96 strata empty and only 8 with >=50 observations.
BLOCK_EDGES = [-1, 6, 15, 20, 23]
BLOCK_LABELS = ["night", "midday", "peak", "evening"]

# Counts events once weight_by="event", not intervals, so it is lower than an
# interval-based threshold would be.
MIN_STRATUM_OBS = 8

# Accepted risk, not a defect. The baseline model's p10 coverage runs 8.3-19.3%
# across walk-forward folds against a 10% target, because a single calendar year
# of ResStock means every test fold is a season absent from training. The misses
# are shallow, though: measured shortfall is 1.1-3.0% of committed kWh (macro
# 1.9%), so committing slightly above the requirement absorbs it.
#
# Deliberately not fixed. Conformal calibration tightens coverage to 10.7% but
# costs 4.7% MAE on the settlement baseline -- the number that sets every payout
# -- to recover ~2% on commitment sizing. Bad trade. This factor is the
# insurance premium paid instead.
OVER_PROCUREMENT_FACTOR = 1.03


def add_strata(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["season"] = out["ts"].dt.month.map(SEASONS)
    hours = out["hour"] if "hour" in out.columns else out["ts"].dt.hour
    out["block"] = pd.cut(hours, BLOCK_EDGES, labels=BLOCK_LABELS)
    return out


def realised_price(df: pd.DataFrame, window_h: int = 1) -> pd.Series:
    """Mean price over the delivery window -- what the aggregator actually earns.

    Revenue is ``sum(delivered_kwh x price_per_kwh)`` across the window, so the
    conditional expectations must be built from the same quantity, not from the
    spot price at the decision instant.
    """
    steps = window_h * 4
    return df["lz_austin_price"].shift(-1).rolling(steps, min_periods=steps).mean().shift(-(steps - 1))


@dataclass
class Valuation:
    """Everything needed to price and collateralise one event."""

    p_spike: float
    e_spike: float            # $/kWh
    e_no_spike: float         # $/kWh
    fair_value: float         # $/kWh
    risk_buffer: float        # $/kWh
    aggregator_fee: float     # $/kWh
    locked_price: float       # $/kWh
    stratum: str
    n_obs: int
    fallback_level: str

    def as_dict(self) -> dict:
        return {k: (round(v, 6) if isinstance(v, float) else v) for k, v in self.__dict__.items()}


@dataclass
class PriceStatistics:
    """Stratified conditional price statistics, in $/MWh internally."""

    estimator: str = "trimmed_mean"
    trim: float = 0.1
    min_obs: int = MIN_STRATUM_OBS
    # Spike intervals cluster into episodes: summer|peak has 646 intervals but
    # only 74 distinct events, and the longest episodes are also the most
    # severe (one 19-interval event averaged $4,276/MWh). Interval-weighting
    # therefore lets a handful of catastrophes dominate.
    #
    # The orchestrator commits once per episode -- §4.1 allows one active event
    # with a cooldown -- so each episode is one draw, not seven. Weighting by
    # event matches how the price is actually realised, and collapses the gap
    # between estimators: summer|peak per-event reads 950 / 965 / 962 for
    # mean / median / trimmed, against 1302 / 822 / 1023 per-interval.
    weight_by: str = "event"
    event_gap_hours: int = 1
    table: dict = field(default_factory=dict)
    global_stats: dict = field(default_factory=dict)
    fitted_window: list[str] | None = None

    def _central(self, values) -> float:
        values = np.asarray(values, dtype=float)
        if len(values) == 0:
            return float("nan")
        if self.estimator == "median":
            return float(np.median(values))
        if self.estimator == "mean":
            return float(np.mean(values))
        if self.estimator == "trimmed_mean":
            lo, hi = np.quantile(values, [self.trim, 1 - self.trim])
            kept = values[(values >= lo) & (values <= hi)]
            return float(np.mean(kept)) if len(kept) else float(np.mean(values))
        raise ValueError(f"Unknown estimator: {self.estimator!r}")

    def _spike_values(self, group: pd.DataFrame) -> np.ndarray:
        """Spike observations, one per event when event-weighted."""
        spikes = group.loc[group["spike_1h"] == 1].sort_values("ts")
        if self.weight_by == "interval" or spikes.empty:
            return spikes["realised"].to_numpy()
        gap = spikes["ts"].diff() > pd.Timedelta(hours=self.event_gap_hours)
        episode = gap.cumsum()
        # Collapse each episode with a plain mean: the representative price for
        # an event is what you would realise across its delivery windows. The
        # chosen estimator is applied once, across episodes -- applying it here
        # too would trim the severe events twice and understate them.
        return spikes.groupby(episode)["realised"].mean().to_numpy()

    def _summarise(self, group: pd.DataFrame) -> dict:
        spike = self._spike_values(group)
        # The calm term is not clustered the same way and its distribution is
        # tight, so it stays interval-weighted.
        calm = group.loc[group["spike_1h"] == 0, "realised"].to_numpy()
        return {
            "e_spike": self._central(spike),
            "e_no_spike": self._central(calm),
            "p10": float(np.quantile(spike, 0.10)) if len(spike) else float("nan"),
            "p50": float(np.quantile(spike, 0.50)) if len(spike) else float("nan"),
            "p90": float(np.quantile(spike, 0.90)) if len(spike) else float("nan"),
            "n_spike": int(len(spike)),
            "n_spike_intervals": int((group["spike_1h"] == 1).sum()),
            "n_total": int(len(group)),
        }

    def fit(self, df: pd.DataFrame, window_h: int = 1) -> "PriceStatistics":
        frame = add_strata(df).copy()
        frame["realised"] = realised_price(frame, window_h=window_h)
        frame = frame.dropna(subset=["realised"])

        self.global_stats = self._summarise(frame)
        self.fitted_window = [str(frame["ts"].min()), str(frame["ts"].max())]

        self.table = {}
        for (season, block), g in frame.groupby(["season", "block"], observed=True):
            self.table[f"{season}|{block}"] = self._summarise(g)
        for block, g in frame.groupby("block", observed=True):
            self.table[f"*|{block}"] = self._summarise(g)
        return self

    def lookup(self, season: str, block: str) -> tuple[dict, str, str]:
        """Most specific stratum with enough spike observations.

        Falls back season+block -> block -> global rather than returning a
        statistic built on a handful of events.
        """
        for key, level in ((f"{season}|{block}", "season+block"), (f"*|{block}", "block")):
            stats = self.table.get(key)
            if stats and stats["n_spike"] >= self.min_obs:
                return stats, key, level
        return self.global_stats, "global", "global"

    def save(self, path: Path | str) -> dict:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "estimator": self.estimator,
            "trim": self.trim,
            "min_obs": self.min_obs,
            "weight_by": self.weight_by,
            "fitted_window": self.fitted_window,
            "global": self.global_stats,
            "table": self.table,
        }
        body = json.dumps(payload, indent=2, sort_keys=True)
        path.write_text(body)
        return {"path": str(path), "sha256": hashlib.sha256(body.encode()).hexdigest()}

    @classmethod
    def load(cls, path: Path | str) -> "PriceStatistics":
        payload = json.loads(Path(path).read_text())
        obj = cls(
            estimator=payload["estimator"],
            trim=payload["trim"],
            min_obs=payload["min_obs"],
            weight_by=payload.get("weight_by", "event"),
        )
        obj.table = payload["table"]
        obj.global_stats = payload["global"]
        obj.fitted_window = payload.get("fitted_window")
        return obj


def value_event(
    p_spike: float,
    ts: pd.Timestamp,
    stats: PriceStatistics,
    buffer_k: float = 0.5,
    aggregator_fee_per_kwh: float = 0.01,
) -> Valuation:
    """Price one event window. Returns $/kWh, converted from ERCOT's $/MWh."""
    season = SEASONS[ts.month]
    block = BLOCK_LABELS[int(np.digitize(ts.hour, BLOCK_EDGES[1:-1]))]
    s, key, level = stats.lookup(season, block)

    e_spike = s["e_spike"] / MWH_TO_KWH
    e_no = s["e_no_spike"] / MWH_TO_KWH
    fair = p_spike * e_spike + (1 - p_spike) * e_no

    spread = (s["p50"] - s["p10"]) / MWH_TO_KWH
    # Scale the buffer by P(spike): an unlikely event carries less price risk
    # because its fair value is dominated by the calm-price term.
    risk_buffer = buffer_k * spread * p_spike if np.isfinite(spread) else 0.0
    locked = fair - risk_buffer - aggregator_fee_per_kwh

    return Valuation(
        p_spike=float(p_spike),
        e_spike=e_spike,
        e_no_spike=e_no,
        fair_value=fair,
        risk_buffer=float(risk_buffer),
        aggregator_fee=aggregator_fee_per_kwh,
        locked_price=locked,
        stratum=key,
        n_obs=s["n_spike"],
        fallback_level=level,
    )


def select_homes(
    offerable_kw: pd.Series,
    required_flex_kw: float,
    window_hours: float,
    last_dispatched: pd.Series | None = None,
    events_this_month: pd.Series | None = None,
    fatigue_cap: int = 4,
    over_procurement: float = OVER_PROCUREMENT_FACTOR,
) -> pd.Series:
    """Pick enough homes to cover the requirement, respecting fatigue caps.

    Greedy by least-recently-dispatched rather than by cheapest: at this fleet
    size greedy lands within a percent of an LP optimum, it is trivially
    auditable on-chain, and rotating is defensible to a participant in a way
    that "the optimiser picked you again" is not.

    Targets ``required_flex_kw x over_procurement`` because commitments are not
    always met; see ``OVER_PROCUREMENT_FACTOR``.
    """
    eligible = offerable_kw[offerable_kw > 0]
    if events_this_month is not None:
        under_cap = events_this_month.reindex(eligible.index).fillna(0) < fatigue_cap
        eligible = eligible[under_cap]

    if last_dispatched is not None:
        order = last_dispatched.reindex(eligible.index).fillna(pd.Timestamp.min).sort_values().index
    else:
        order = eligible.sort_values(ascending=False).index

    target_kw = required_flex_kw * over_procurement
    running, chosen = 0.0, []
    for home in order:
        if running >= target_kw:
            break
        chosen.append(home)
        running += eligible[home]
    return eligible[chosen]


def size_event(
    valuation: Valuation,
    offerable_kw: np.ndarray,
    window_hours: float,
    min_locked_price: float = 0.02,
    min_event_kwh: float = 10.0,
    required_flex_kw: float | None = None,
    over_procurement: float = OVER_PROCUREMENT_FACTOR,
) -> dict:
    """Turn a valuation plus per-home offers into a committed event.

    Applies the §3.3 guardrails: an event below ``min_locked_price`` or
    ``min_event_kwh`` is not worth running and is skipped rather than priced.
    """
    committed = np.asarray(offerable_kw, dtype=float) * window_hours
    total_kwh = float(committed.sum())
    collateral = valuation.locked_price * total_kwh

    # The fleet may be unable to cover the requirement -- too small, or too many
    # homes at their fatigue cap. Report it rather than quietly committing less
    # than the zone needs.
    target_kwh = None
    coverage = None
    if required_flex_kw is not None:
        target_kwh = required_flex_kw * over_procurement * window_hours
        coverage = total_kwh / target_kwh if target_kwh else float("nan")

    skip = None
    if valuation.locked_price <= min_locked_price:
        skip = f"locked_price {valuation.locked_price:.4f} <= min {min_locked_price}"
    elif total_kwh < min_event_kwh:
        skip = f"committed {total_kwh:.1f} kWh < min {min_event_kwh}"
    elif coverage is not None and coverage < 1.0:
        skip = (
            f"fleet covers {total_kwh:.1f} of {target_kwh:.1f} kWh needed "
            f"({coverage:.0%}); requirement unmet"
        )

    return {
        "n_homes": int(len(committed)),
        "committed_kwh": total_kwh,
        "target_kwh": target_kwh,
        "coverage": coverage,
        "locked_price_per_kwh": valuation.locked_price,
        "collateral": float(collateral),
        "expected_revenue": float(valuation.fair_value * total_kwh),
        "expected_margin": float((valuation.fair_value - valuation.locked_price) * total_kwh),
        "skip_reason": skip,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fit and inspect fair-value price statistics.")
    parser.add_argument("--start-year", type=int, default=2021)
    parser.add_argument("--end-year", type=int, default=2024)
    parser.add_argument(
        "--estimator", choices=("trimmed_mean", "mean", "median"), default="trimmed_mean"
    )
    parser.add_argument("--weight-by", choices=("event", "interval"), default="event")
    parser.add_argument("--keep-uri", action="store_true")
    parser.add_argument("--save", action="store_true")
    args = parser.parse_args()

    from ml.features import build_feature_frame
    from ml.ingest import build_real_dataset, drop_excluded_regimes

    df = build_feature_frame(build_real_dataset(args.start_year, args.end_year))
    if not args.keep_uri:
        df = drop_excluded_regimes(df)

    stats = PriceStatistics(estimator=args.estimator, weight_by=args.weight_by).fit(df)
    g = stats.global_stats
    print(f"\nfitted {stats.fitted_window[0]} -> {stats.fitted_window[1]}  "
          f"({g['n_total']:,} intervals, {g['n_spike']:,} spike)")
    print(f"global  E[price|spike]=${g['e_spike']:.0f}/MWh  "
          f"E[price|no spike]=${g['e_no_spike']:.0f}/MWh  "
          f"p10=${g['p10']:.0f}  p50=${g['p50']:.0f}  p90=${g['p90']:.0f}")

    print(f"\n=== strata ({args.estimator}, min {stats.min_obs} spike obs) ===")
    print("%-18s %9s %12s %14s %10s" % ("stratum", "n_spike", "E[p|spike]", "E[p|no spike]", "p50"))
    for key in sorted(k for k in stats.table if not k.startswith("*")):
        s = stats.table[key]
        flag = "" if s["n_spike"] >= stats.min_obs else "  (thin -> falls back)"
        print("%-18s %9d %11.0f %13.0f %10.0f%s"
              % (key, s["n_spike"], s["e_spike"], s["e_no_spike"], s["p50"], flag))

    print("\n=== worked valuations ($/kWh) ===")
    print("%-26s %7s %11s %11s %12s %10s" % ("window", "P(spike)", "fair_value", "buffer", "locked", "stratum"))
    for ts, p in [
        (pd.Timestamp("2024-08-14 17:00"), 0.60),
        (pd.Timestamp("2024-08-14 17:00"), 0.20),
        (pd.Timestamp("2024-11-05 12:00"), 0.35),
        (pd.Timestamp("2024-01-16 07:00"), 0.50),
    ]:
        v = value_event(p, ts, stats)
        print("%-26s %7.2f %11.4f %11.4f %12.4f %10s"
              % (f"{ts:%Y-%m-%d %H:%M}", p, v.fair_value, v.risk_buffer, v.locked_price, v.stratum))

    if args.save:
        out = Path(__file__).resolve().parent / "artifacts" / "price_statistics.json"
        meta = stats.save(out)
        print(f"\nSaved {meta['path']}  sha256={meta['sha256'][:16]}...")


if __name__ == "__main__":
    main()
