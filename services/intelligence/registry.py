"""Model and replay loading for the intelligence service.

Each piece loads independently from ``MODEL_DIR`` and is checked against its
manifest hash. Anything missing or broken falls back to the placeholder the
orchestration spec defines for day one, and says so in ``source``, so the app
always gets an answer and can show where it came from.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from ml.baseline_model import BaselineQuantileModel
from ml.fair_value import PriceStatistics
from ml.spike_model import LightGBMSpikeModel, PlaceholderSpikeModel

log = logging.getLogger("intelligence")

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_DIR = ROOT / "ml" / "artifacts"

# Placeholder price statistics: the measured ERCOT LZ_AEN figures from
# docs/home-models-plan.md §3.2 (2021-2024, Uri excluded), in $/MWh. p10 is left
# unknown, which makes value_event apply no risk buffer.
PLACEHOLDER_PRICES = {
    "e_spike": 1033.0,
    "e_no_spike": 34.0,
    "p10": float("nan"),
    "p50": 627.0,
    "p90": float("nan"),
    "n_spike": 0,
    "n_spike_intervals": 0,
    "n_total": 0,
}

# Placeholder baseline: a typical Austin summer-evening draw per home, in kW.
PLACEHOLDER_BASELINE_KW = {"p50": 2.0, "p10": 1.2}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@dataclass
class Component:
    """One loaded piece and where it came from."""

    source: str  # "model" | "placeholder"
    sha256: str | None = None
    detail: str | None = None

    def as_dict(self) -> dict:
        return {"source": self.source, "sha256": self.sha256, "detail": self.detail}


@dataclass
class Registry:
    spike: LightGBMSpikeModel | PlaceholderSpikeModel
    prices: PriceStatistics
    baseline: BaselineQuantileModel | None
    grid: pd.DataFrame | None
    homes: pd.DataFrame | None
    replay: dict
    status: dict[str, Component] = field(default_factory=dict)

    @property
    def settlement_point(self) -> str:
        return self.replay.get("settlement_point", "LZ_AEN")

    def default_at(self) -> pd.Timestamp:
        override = os.environ.get("REPLAY_AT")
        if override:
            return pd.Timestamp(override)
        if "default_at" in self.replay:
            return pd.Timestamp(self.replay["default_at"])
        # No replay: a summer weekday evening, so the time-of-day strata apply.
        return pd.Timestamp("2024-08-20T17:00:00")

    def health(self) -> dict:
        return {name: c.as_dict() for name, c in self.status.items()}


def _load_spike(model_dir: Path):
    path = model_dir / "spike"
    try:
        model = LightGBMSpikeModel.load(path)
        return model, Component("model", sha256_file(path / "manifest.json"))
    except FileNotFoundError:
        detail = f"no spike model at {path}"
    except Exception as error:  # noqa: BLE001 -- any failure falls back
        detail = f"spike model failed to load: {error}"
    log.warning(detail)
    return PlaceholderSpikeModel(), Component("placeholder", detail=detail)


def _load_prices(model_dir: Path):
    path = model_dir / "price_statistics.json"
    try:
        stats = PriceStatistics.load(path)
        return stats, Component("model", sha256_file(path))
    except FileNotFoundError:
        detail = f"no price statistics at {path}"
    except Exception as error:  # noqa: BLE001
        detail = f"price statistics failed to load: {error}"
    log.warning(detail)
    stats = PriceStatistics()
    stats.global_stats = dict(PLACEHOLDER_PRICES)
    return stats, Component("placeholder", detail=detail)


def _load_baseline(model_dir: Path):
    path = model_dir / "baseline"
    try:
        model = BaselineQuantileModel.load(path)
        return model, Component("model", sha256_file(path / "manifest.json"))
    except FileNotFoundError:
        detail = f"no baseline model at {path}"
    except Exception as error:  # noqa: BLE001
        detail = f"baseline model failed to load: {error}"
    log.warning(detail)
    return None, Component("placeholder", detail=detail)


def _load_replay(model_dir: Path):
    path = model_dir / "replay"
    manifest_path = path / "manifest.json"
    if not manifest_path.exists():
        detail = f"no replay data at {path}"
        log.warning(detail)
        return None, None, {}, Component("placeholder", detail=detail)
    manifest = json.loads(manifest_path.read_text())
    grid = homes = None
    problems = []
    for key, file_key, hash_key in (("grid", "grid_file", "grid_sha256"), ("homes", "homes_file", "homes_sha256")):
        if file_key not in manifest:
            problems.append(f"{key} slice not exported")
            continue
        file = path / manifest[file_key]
        if sha256_file(file) != manifest[hash_key]:
            problems.append(f"{file.name} does not match its manifest hash")
            continue
        frame = pd.read_parquet(file)
        if key == "grid":
            grid = frame
        else:
            homes = frame
    detail = "; ".join(problems) or None
    if detail:
        log.warning(detail)
    source = "model" if grid is not None else "placeholder"
    return grid, homes, manifest, Component(source, sha256_file(manifest_path), detail)


def load_registry(model_dir: str | Path | None = None) -> Registry:
    model_dir = Path(model_dir or os.environ.get("MODEL_DIR") or DEFAULT_MODEL_DIR)
    spike, spike_status = _load_spike(model_dir)
    prices, price_status = _load_prices(model_dir)
    baseline, baseline_status = _load_baseline(model_dir)
    grid, homes, replay, replay_status = _load_replay(model_dir)
    return Registry(
        spike=spike,
        prices=prices,
        baseline=baseline,
        grid=grid,
        homes=homes,
        replay=replay,
        status={
            "spike": spike_status,
            "prices": price_status,
            "baseline": baseline_status,
            "replay": replay_status,
        },
    )
