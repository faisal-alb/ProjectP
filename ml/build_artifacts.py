from __future__ import annotations

"""Rebuild everything the intelligence service loads, from public data.

    python -m ml.build_artifacts            # or: npm run ml:train

Steps, in order (each script caches its downloads in ml/data_cache/):

1. Spike classifier on ERCOT LZ_AEN, trained before ``TRAIN_END``.
2. Fair-value price statistics, same cutoff, Winter Storm Uri excluded.
3. Replay evening: the summer ``REPLAY_YEAR`` evening whose 7-8 PM window
   cleared highest, which neither of the above has seen.
4. Home baseline on ResStock Travis County, with that calendar stretch held out.
5. Replay slice of home features for the same day.

Artifacts land in ml/artifacts/ with hashed manifests. They are not committed;
see docs/intelligence.md for where they live in a deployment.
"""

import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
TRAIN_END = "2024-06-01"
REPLAY_YEAR = 2024
BASELINE_HORIZON_H = 3  # decide at 5 PM for a window that ends at 8 PM


def run(*args: str) -> None:
    print(f"\n$ python -m {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, "-m", *args], cwd=ROOT, check=True)


def main() -> None:
    run("ml.train_spike_model", "--train-end", TRAIN_END, "--skip-seasonality")
    run("ml.fair_value", "--train-end", TRAIN_END, "--save")
    run("ml.export_replay", "grid", "--year", str(REPLAY_YEAR))

    from ml.export_replay import MANIFEST, to_homes_time

    replay = json.loads(MANIFEST.read_text())
    start = to_homes_time(pd.Timestamp(replay["default_at"]) + pd.Timedelta(hours=replay["lead_h"]))
    lo = (start.normalize() - pd.Timedelta(days=7)).date()
    hi = (start.normalize() + pd.Timedelta(days=2)).date()
    run(
        "ml.baseline_model",
        "--horizon", str(BASELINE_HORIZON_H),
        "--folds", "4",
        "--exclude-window", str(lo), str(hi),
        "--save",
    )
    run("ml.export_replay", "homes", "--horizon", str(BASELINE_HORIZON_H))
    print("\nDone. Artifacts are in ml/artifacts/.")


if __name__ == "__main__":
    main()
