"""EWMA control-chart detector.

Tracks an exponentially-weighted moving mean and variance. Unlike a fixed window
it has unbounded but decaying memory, so it adapts to slow regime shifts while
still catching sudden departures. Flags when the value sits more than
``threshold`` EWMA-standard-deviations from the EWMA mean.
"""

from __future__ import annotations

import math
from typing import Dict, Optional

from tracewave.models import DetectorResult
from tracewave.processing.detectors.base import Detector, logistic


class EwmaDetector(Detector):
    name = "ewma"

    def __init__(self, alpha: float = 0.08, threshold: float = 3.0,
                 warmup: int = 12, direction: str = "both") -> None:
        self.alpha = alpha
        self.threshold = threshold
        self.warmup = warmup
        self.direction = direction
        self._mean: Optional[float] = None
        self._var: float = 0.0
        self._n: int = 0

    def update(self, value: float, features: Optional[Dict[str, float]] = None) -> DetectorResult:
        self._n += 1
        if self._mean is None:
            self._mean = value
            return self._result(False, 0.0, value, value, warmup=True)

        # Score against the *current* estimate, then update it.
        mean = self._mean
        std = math.sqrt(self._var)
        delta = value - mean

        a = self.alpha
        self._mean = mean + a * delta
        self._var = (1 - a) * (self._var + a * delta * delta)

        if self._n <= self.warmup or std < 1e-9:
            if std < 1e-9 and self._n > self.warmup:
                departed = abs(delta) > 1e-9
                flag = departed and self._dir_ok(delta)
                return self._result(flag, 0.6 if flag else 0.0, value, mean,
                                    z=0.0, mean=round(mean, 4))
            return self._result(False, 0.0, value, mean, warmup=True,
                                mean=round(mean, 4))

        z = delta / std
        directional = self._dir_ok(delta)
        flag = directional and abs(z) >= self.threshold
        score = logistic(abs(z) - self.threshold) if directional else 0.0
        return self._result(flag, score, value, mean, z=round(z, 3),
                            std=round(std, 4), mean=round(mean, 4))

    def _dir_ok(self, delta: float) -> bool:
        if self.direction == "up":
            return delta > 0
        if self.direction == "down":
            return delta < 0
        return True
