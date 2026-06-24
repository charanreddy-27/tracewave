"""Half-Space Trees detector (online, multivariate) via `river`.

Half-Space Trees produce an anomaly score in [0, 1] from an unlabelled stream.
We feed the *full* metric feature vector (rate, distinct subjects/actors, bot
ratio, bytes/sec, ...) so this detector gives a holistic "is this moment weird?"
opinion, complementing the two univariate detectors.

`river` is an optional dependency. If it is not installed the detector degrades
gracefully: ``available = False`` and it never flags, so the rest of the pipeline
(and the tests) run unchanged.
"""

from __future__ import annotations

from typing import Dict, Optional

from tracewave.models import DetectorResult
from tracewave.processing.detectors.base import Detector

try:  # pragma: no cover - exercised only when river is installed
    from river import anomaly, preprocessing, compose

    _RIVER_OK = True
except Exception:  # pragma: no cover
    _RIVER_OK = False


class HalfSpaceTreesDetector(Detector):
    name = "hst"

    def __init__(self, threshold: float = 0.8, warmup: int = 50,
                 n_trees: int = 25, height: int = 8, window_size: int = 120,
                 seed: int = 7) -> None:
        self.threshold = threshold
        self.warmup = warmup
        self.available = _RIVER_OK
        self._n = 0
        if _RIVER_OK:
            # Min-max scaling keeps every feature on [0,1], which HST assumes.
            self._model = compose.Pipeline(
                preprocessing.MinMaxScaler(),
                anomaly.HalfSpaceTrees(
                    n_trees=n_trees,
                    height=height,
                    window_size=window_size,
                    seed=seed,
                ),
            )
        else:
            self._model = None

    def update(self, value: float, features: Optional[Dict[str, float]] = None) -> DetectorResult:
        if not self.available:
            return self._result(False, 0.0, value, value, unavailable=True)

        feats = dict(features) if features else {"value": float(value)}
        self._n += 1
        # score_one before learn_one: score the point against the model so far.
        score = float(self._model.score_one(feats))
        self._model.learn_one(feats)

        if self._n <= self.warmup:
            return self._result(False, 0.0, value, value, warmup=True,
                                raw_score=round(score, 4))

        flag = score >= self.threshold
        return self._result(flag, score, value, value, raw_score=round(score, 4))
