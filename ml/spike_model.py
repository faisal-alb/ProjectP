from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, Sequence

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

# Labels look ahead up to 6h at 15-minute resolution.
_EMBARGO_INTERVALS = 6 * 4


@dataclass
class LightGBMSpikeModel:
    """Single-horizon LightGBM classifier that matches the orchestrator contract.

    Output contract: dict[int, float] keyed by horizon hours.
    """

    horizons: Sequence[int] = (1, 2, 3, 4, 5, 6)
    params: dict | None = None
    models: Dict[int, lgb.Booster] = field(default_factory=dict)
    feature_names: list[str] = field(default_factory=list)
    calibrate: bool = False
    calibration_method: str = "sigmoid"  # "sigmoid" (Platt) or "isotonic"
    calibration_frac: float = 0.2
    refit_full: bool = True
    calibrators: Dict[int, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.params is None:
            self.params = {
                "objective": "binary",
                "metric": "auc",
                "learning_rate": 0.05,
                "num_leaves": 31,
                "feature_fraction": 0.9,
                "bagging_fraction": 0.8,
                "min_data_in_leaf": 50,
                "verbosity": -1,
                "random_state": 42,
            }

    def fit(self, X: pd.DataFrame, y_map: dict[int, pd.Series]) -> "LightGBMSpikeModel":
        """Train one LightGBM model per forecast horizon, then calibrate.

        Raw LightGBM probabilities rank well but are not reliable as
        probabilities, and the orchestrator's ``fair_value`` multiplies
        ``P(spike)`` by a dollar amount, so the scale has to be trustworthy.
        Isotonic regression is fit on a chronological tail of the training data
        that the booster never saw, with the usual embargo so the calibration
        slice is not labelled from prices inside the booster's own window.

        Isotonic is monotonic, so it cannot change the ranking: PR-AUC is
        unchanged and only the calibration improves.
        """
        self.models = {}
        self.calibrators = {}
        feature_cols = [c for c in X.columns if c not in {"ts"}]
        # Remembered so inference uses the exact training columns, in order.
        self.feature_names = list(feature_cols)

        n = len(X)
        cut = int(n * (1 - self.calibration_frac))
        fit_slice = slice(0, max(0, cut - _EMBARGO_INTERVALS))
        cal_slice = slice(cut, n)
        # Only split when the calibration slice is big enough to be meaningful.
        use_split = self.calibrate and (n - cut) >= 500 and fit_slice.stop > 500

        for horizon in self.horizons:
            if horizon not in y_map:
                raise KeyError(f"Missing label for horizon {horizon}")
            label = y_map[horizon].astype(int)
            train_X = X[feature_cols]
            train_y = label.to_numpy()

            if use_split:
                base_X, base_y = train_X.iloc[fit_slice], train_y[fit_slice]
                cal_X, cal_y = train_X.iloc[cal_slice], train_y[cal_slice]
            else:
                base_X, base_y = train_X, train_y
                cal_X = cal_y = None

            model = lgb.LGBMClassifier(**self.params)
            model.fit(base_X.copy(), base_y)

            # A calibrator needs both classes present to learn anything.
            if cal_X is not None and len(np.unique(cal_y)) == 2:
                raw = model.predict_proba(cal_X.copy())[:, 1]
                self.calibrators[horizon] = self._fit_calibrator(raw, cal_y)

                if self.refit_full:
                    # Recover the data the calibration split cost us: the
                    # calibrator's shape transfers, and a booster trained on the
                    # full window ranks better than one trained on 80% of it.
                    model = lgb.LGBMClassifier(**self.params)
                    model.fit(train_X.copy(), train_y)

            self.models[horizon] = model

        return self

    def _align(self, X: pd.DataFrame) -> list[str]:
        """Return the training feature columns, erroring on any that are absent."""
        if not self.feature_names:
            return [c for c in X.columns if c not in {"ts"}]
        missing = [c for c in self.feature_names if c not in X.columns]
        if missing:
            raise KeyError(f"Input is missing training features: {missing}")
        return self.feature_names

    def _fit_calibrator(self, raw: np.ndarray, y: np.ndarray):
        """Fit a monotone map from raw score to calibrated probability.

        ``sigmoid`` (Platt) is the default: two parameters, so it needs far fewer
        positives than isotonic, and it is strictly increasing, so it introduces
        no ties and cannot degrade ranking. ``isotonic`` is more flexible but on
        a ~1% positive class its steps are wide enough to collapse distinct
        scores together, which measurably costs PR-AUC.
        """
        if self.calibration_method == "isotonic":
            iso = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
            iso.fit(raw, y)
            return iso
        if self.calibration_method == "sigmoid":
            lr = LogisticRegression(C=1e10, solver="lbfgs")
            # Fit in logit space so the map is a rescaling of the score, not of
            # the probability, which is what Platt scaling actually is.
            eps = 1e-6
            z = np.log(np.clip(raw, eps, 1 - eps) / (1 - np.clip(raw, eps, 1 - eps)))
            lr.fit(z.reshape(-1, 1), y)
            return lr
        raise ValueError(f"Unknown calibration_method: {self.calibration_method!r}")

    def _apply_calibration(self, horizon: int, raw: np.ndarray) -> np.ndarray:
        """Map raw scores through this horizon's calibrator, if one was fit."""
        cal = self.calibrators.get(horizon)
        if cal is None:
            return raw
        if isinstance(cal, LogisticRegression):
            eps = 1e-6
            clipped = np.clip(raw, eps, 1 - eps)
            z = np.log(clipped / (1 - clipped))
            return cal.predict_proba(z.reshape(-1, 1))[:, 1]
        return cal.predict(raw)

    def predict(self, X: pd.DataFrame) -> dict[int, float]:
        """Return a probability for each horizon in the orchestration contract."""
        if not self.models:
            raise ValueError("Model has not been fit yet")

        feature_cols = self._align(X)
        probs: dict[int, float] = {}
        for horizon in self.horizons:
            model = self.models[horizon]
            prob = model.predict_proba(X[feature_cols])[:, 1]
            prob = self._apply_calibration(horizon, prob)
            probs[horizon] = float(np.clip(prob[0], 0.0, 1.0))
        return probs

    def predict_many(self, X: pd.DataFrame) -> np.ndarray:
        """Convenience method for batches of rows."""
        if not self.models:
            raise ValueError("Model has not been fit yet")

        feature_cols = self._align(X)
        batch = X[feature_cols].copy()
        out = []
        for horizon in self.horizons:
            raw = self.models[horizon].predict_proba(batch)[:, 1]
            out.append(self._apply_calibration(horizon, raw))
        return np.column_stack(out)


class PlaceholderSpikeModel:
    """Fallback used when a model fails or is not ready yet."""

    def __init__(self, default_probability: float = 0.2):
        self.default_probability = default_probability

    def _fit_calibrator(self, raw: np.ndarray, y: np.ndarray):
        """Fit a monotone map from raw score to calibrated probability.

        ``sigmoid`` (Platt) is the default: two parameters, so it needs far fewer
        positives than isotonic, and it is strictly increasing, so it introduces
        no ties and cannot degrade ranking. ``isotonic`` is more flexible but on
        a ~1% positive class its steps are wide enough to collapse distinct
        scores together, which measurably costs PR-AUC.
        """
        if self.calibration_method == "isotonic":
            iso = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
            iso.fit(raw, y)
            return iso
        if self.calibration_method == "sigmoid":
            lr = LogisticRegression(C=1e10, solver="lbfgs")
            # Fit in logit space so the map is a rescaling of the score, not of
            # the probability, which is what Platt scaling actually is.
            eps = 1e-6
            z = np.log(np.clip(raw, eps, 1 - eps) / (1 - np.clip(raw, eps, 1 - eps)))
            lr.fit(z.reshape(-1, 1), y)
            return lr
        raise ValueError(f"Unknown calibration_method: {self.calibration_method!r}")

    def _apply_calibration(self, horizon: int, raw: np.ndarray) -> np.ndarray:
        """Map raw scores through this horizon's calibrator, if one was fit."""
        cal = self.calibrators.get(horizon)
        if cal is None:
            return raw
        if isinstance(cal, LogisticRegression):
            eps = 1e-6
            clipped = np.clip(raw, eps, 1 - eps)
            z = np.log(clipped / (1 - clipped))
            return cal.predict_proba(z.reshape(-1, 1))[:, 1]
        return cal.predict(raw)

    def predict(self, X: pd.DataFrame) -> dict[int, float]:
        return {h: float(self.default_probability) for h in (1, 2, 3, 4, 5, 6)}
