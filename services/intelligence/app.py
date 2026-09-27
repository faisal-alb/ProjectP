"""GridFlex intelligence service: the models behind the forecast and the baseline.

Internal only. The Node API calls it at fixed points in the market lifecycle and
stays the only thing that talks to the browser or to Solana:

* ``GET /forecast/{zone}`` -- spike probability by horizon, fair value, the
  locked price it implies, and whether the trigger rule would open an event.
* ``POST /events/size`` -- per-home baselines (p50, the settlement
  counterfactual) and offerable kW (from p10) for an event window, with the
  hashes that commit to them.

The clock is a replay of a real, held-out ERCOT evening (see
``ml/export_replay.py``), so answers are deterministic. Models predict here;
the API decides what to commit.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import sys
from contextlib import asynccontextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from ml.baseline_model import INTERVALS_PER_HOUR, offerable_kw
from ml.export_replay import to_homes_time
from ml.fair_value import value_event

try:  # run as a package (uvicorn services.intelligence.app:app) or from its folder
    from .registry import PLACEHOLDER_BASELINE_KW, Registry, load_registry
except ImportError:
    from registry import PLACEHOLDER_BASELINE_KW, Registry, load_registry

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("intelligence")

# Zones the app knows, all inside Austin Energy's ERCOT load zone.
ZONES = {"downtown": "Downtown Austin"}

# Event timing, from the orchestration spec's trigger section: decide two hours
# ahead, one-hour window. P(spike) is read at the horizon that reaches the
# window's end.
LEAD_H = 2
WINDOW_H = 1
TRIGGER_THRESHOLD = 0.5  # docs/home-models-plan.md §3.3
SPIKE_THRESHOLD_MWH = 500.0

registry: Registry | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global registry
    registry = load_registry()
    for name, status in registry.health().items():
        log.info("%s: %s %s", name, status["source"], status["detail"] or status["sha256"][:12])
    yield


app = FastAPI(title="GridFlex intelligence", lifespan=lifespan)


def reg() -> Registry:
    if registry is None:
        raise HTTPException(503, "Models are still loading")
    return registry


def canonical_hash(value) -> str:
    """sha256 of canonical JSON: sorted keys, no whitespace."""
    body = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode()).hexdigest()


def finite(value, digits: int = 4):
    if value is None:
        return None
    value = float(value)
    return round(value, digits) if math.isfinite(value) else None


def resolve_at(r: Registry, at: str | None) -> pd.Timestamp:
    try:
        return pd.Timestamp(at) if at else r.default_at()
    except ValueError:
        raise HTTPException(400, f"at must be an ISO timestamp, got {at!r}")


def zone_name(zone: str) -> str:
    if zone not in ZONES:
        raise HTTPException(404, f"Unknown zone {zone!r}")
    return ZONES[zone]


def grid_row(r: Registry, at: pd.Timestamp) -> pd.DataFrame | None:
    """The latest replay feature row at or before ``at``: what was known then."""
    if r.grid is None:
        return None
    rows = r.grid[r.grid["ts"] <= at]
    return None if rows.empty else rows.iloc[[-1]]


def reasons_for(row: pd.DataFrame | None, window_start: pd.Timestamp, horizon: int) -> tuple[list[str], dict]:
    """Plain reason codes and the signals behind them, read off the feature row."""
    reasons = []
    if 16 <= window_start.hour <= 20:
        reasons.append("EVENING_PEAK")
    if window_start.month in (6, 7, 8, 9):
        reasons.append("SUMMER")
    if row is None:
        return reasons, {}
    x = row.iloc[0]
    forecast_temp = x.get(f"forecast_temp_{horizon}h")
    if forecast_temp is not None and forecast_temp >= 95:
        reasons.append("HIGH_TEMPERATURE")
    recent_max = x.get("rolling_price_max_24h")
    if recent_max is not None and recent_max > SPIKE_THRESHOLD_MWH:
        reasons.append("RECENT_PRICE_SPIKE")
    signals = {
        "tempF": finite(x.get("temp_f"), 1),
        "forecastTempF": finite(forecast_temp, 1),
        "lastPriceMwh": finite(x.get("price_lag_1"), 2),
        "recentMaxPriceMwh": finite(recent_max, 2),
    }
    return reasons, signals


@app.get("/health")
def health():
    r = reg()
    return {
        "ok": True,
        "settlementPoint": r.settlement_point,
        "replayAt": r.default_at().isoformat(),
        "models": r.health(),
    }


@app.get("/forecast/{zone}")
def forecast(zone: str, at: str | None = None):
    r = reg()
    name = zone_name(zone)
    now = resolve_at(r, at)
    window_start = now + pd.Timedelta(hours=LEAD_H)
    window_end = window_start + pd.Timedelta(hours=WINDOW_H)
    horizon = LEAD_H + WINDOW_H

    row = grid_row(r, now)
    source = r.status["spike"].source
    try:
        if row is None:
            raise ValueError("no replay row")
        probs = r.spike.predict(row)
    except (KeyError, ValueError) as error:
        if source == "model":
            log.warning("spike prediction fell back to placeholder: %s", error)
        from ml.spike_model import PlaceholderSpikeModel

        probs = PlaceholderSpikeModel().predict(pd.DataFrame())
        source = "placeholder"

    p_spike = probs.get(horizon, max(probs.values()))
    valuation = value_event(p_spike, window_start, r.prices)
    reasons, signals = reasons_for(row, window_start, horizon)
    open_event = p_spike >= TRIGGER_THRESHOLD and valuation.locked_price > 0

    return {
        "zone": zone,
        "zoneName": name,
        "settlementPoint": r.settlement_point,
        "at": now.isoformat(),
        "window": {"start": window_start.isoformat(), "end": window_end.isoformat()},
        "source": source if r.status["prices"].source == "model" or source == "placeholder" else "mixed",
        "spike": [{"horizonH": h, "probability": finite(p)} for h, p in sorted(probs.items())],
        "pSpike": finite(p_spike),
        "valuation": {
            "fairValuePerKwh": finite(valuation.fair_value),
            "riskBufferPerKwh": finite(valuation.risk_buffer),
            "aggregatorFeePerKwh": finite(valuation.aggregator_fee),
            "lockedPricePerKwh": finite(valuation.locked_price),
            "expectedSpikePricePerKwh": finite(valuation.e_spike),
            "expectedCalmPricePerKwh": finite(valuation.e_no_spike),
            "stratum": valuation.stratum,
        },
        "recommendation": {
            "openEvent": bool(open_event),
            "threshold": TRIGGER_THRESHOLD,
            "reason": (
                f"P(spike) {p_spike:.0%} is at or above {TRIGGER_THRESHOLD:.0%}"
                if open_event
                else f"P(spike) {p_spike:.0%} is below {TRIGGER_THRESHOLD:.0%}"
            ),
        },
        "reasons": reasons,
        "signals": signals,
        "models": {"spike": r.status["spike"].as_dict(), "prices": r.status["prices"].as_dict()},
    }


class SizeRequest(BaseModel):
    zone: str
    homes: list[str] = Field(min_length=1, max_length=200)
    generationKw: float = Field(0.0, ge=0, le=50)
    at: str | None = None


@app.post("/events/size")
def size_event(req: SizeRequest):
    """Baselines and offerable kW for each requested home, for the event window.

    Home ``i`` in the request is the ``i``-th replay home by building id, so the
    same request always gets the same homes and numbers.
    """
    r = reg()
    zone_name(req.zone)
    now = resolve_at(r, req.at)
    window_start = now + pd.Timedelta(hours=LEAD_H)
    window_end = window_start + pd.Timedelta(hours=WINDOW_H)
    intervals = WINDOW_H * INTERVALS_PER_HOUR

    rows = None
    if r.baseline is not None and r.homes is not None:
        start = to_homes_time(window_start)
        end = start + pd.Timedelta(hours=WINDOW_H)
        rows = r.homes[(r.homes["ts"] >= start) & (r.homes["ts"] < end)]
        ids = sorted(rows["bldg_id"].unique())
        if len(ids) < len(req.homes):
            raise HTTPException(
                422, f"Only {len(ids)} replay homes are available; asked for {len(req.homes)}"
            )
        ids = ids[: len(req.homes)]
        rows = rows[rows["bldg_id"].isin(ids)].sort_values(["bldg_id", "ts"])
        if len(rows) != len(ids) * intervals:
            log.warning("replay homes have gaps in the window; using placeholders")
            rows = None

    homes = []
    features_hash = None
    if rows is not None:
        names = r.baseline.feature_names
        pred = r.baseline.predict(rows[names])
        p50 = pred[0.5].reshape(len(ids), intervals)
        p10 = pred[0.1].reshape(len(ids), intervals)
        for i, resource_id in enumerate(req.homes):
            homes.append(
                {
                    "resourceId": resource_id,
                    "modelHome": ids[i],
                    "intervalsKwh": [round(float(v), 5) for v in p50[i]],
                    "baselineKw": round(float(p50[i].mean()) * INTERVALS_PER_HOUR, 3),
                    "offerableKw": round(float(np.mean(offerable_kw(p10[i], req.generationKw))), 3),
                }
            )
        feature_rows = rows[["bldg_id", "ts", *names]].copy()
        feature_rows["ts"] = feature_rows["ts"].astype(str)
        features_hash = canonical_hash(
            json.loads(feature_rows.round(6).to_json(orient="records"))
        )
        source, model_hash = "model", r.status["baseline"].sha256
    else:
        p50_kwh = PLACEHOLDER_BASELINE_KW["p50"] / INTERVALS_PER_HOUR
        p10_kwh = PLACEHOLDER_BASELINE_KW["p10"] / INTERVALS_PER_HOUR
        for resource_id in req.homes:
            homes.append(
                {
                    "resourceId": resource_id,
                    "modelHome": None,
                    "intervalsKwh": [round(p50_kwh, 5)] * intervals,
                    "baselineKw": PLACEHOLDER_BASELINE_KW["p50"],
                    "offerableKw": round(float(offerable_kw(p10_kwh, req.generationKw)), 3),
                }
            )
        source, model_hash = "placeholder", None

    window = {"start": window_start.isoformat(), "end": window_end.isoformat()}
    # What settlement is measured against, committed before anything is delivered.
    baseline_hash = canonical_hash(
        {
            "zone": req.zone,
            "window": window,
            "homes": {h["resourceId"]: {"modelHome": h["modelHome"], "p50Kwh": h["intervalsKwh"]} for h in homes},
        }
    )
    return {
        "zone": req.zone,
        "at": now.isoformat(),
        "window": window,
        "source": source,
        "homes": homes,
        "baselineHash": baseline_hash,
        "modelHash": model_hash,
        "featuresHash": features_hash,
    }
