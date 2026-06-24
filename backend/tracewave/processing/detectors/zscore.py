"""Rolling z-score detector.

Maintains a sliding window of recent values and flags ticks whose value is more
than ``threshold`` sample-standard-deviations from the window mean. The most
interpretable detector — "this is N sigma above the last M seconds".
"""

from __future__ import annotations

import math
from collections import deque
from typing import Dict, Optional

from tracewave.models import DetectorResult
from tracewave.processing.detectors.base import Detector, logistic


class RollingZScore(Detector):
    name = "zscore"

    def __init__(self, window: int = 60, threshold: float = 3.0,
                 min_samples: int = 12, direction: str = "both") -> None:
        self.window = window
        self.threshold = threshold
        self.min_samples = min_samples
        self.direction = direction  # "up" | "down" | "both"
        self._buf: deque[float] = deque(maxlen=window)

    def update(self, value: float, features: Optional[Dict[str, float]] = None) -> DetectorResult:
        buf = self._buf
        n = len(buf)
        if n < self.min_samples:
            buf.append(value)
            return self._result(False, 0.0, value, value, z=0.0, warmup=True,
                                samples=n)

        mean = sum(buf) / n
        var = sum((x - mean) ** 2 for x in buf) / (n - 1)
        std = math.sqrt(var)
        # Append *after* computing so the current value is scored against history.
        buf.append(value)

        if std < 1e-9:
            # Flat history: any departure is suspicious but unquantifiable by sigma.
            departed = abs(value - mean) > 1e-9
            score = 0.6 if departed else 0.0
            z = math.copysign(float("inf"), value - mean) if departed else 0.0
            flag = departed and self._dir_ok(value - mean)
            return self._result(flag, score if flag else 0.0, value, mean,
                                z=0.0, std=0.0, mean=mean)

        z = (value - mean) / std
        directional = self._dir_ok(value - mean)
        flag = directional and abs(z) >= self.threshold
        # Confidence: logistic centred on the threshold -> 0.5 exactly at the line.
        score = logistic(abs(z) - self.threshold) if directional else 0.0
        return self._result(flag, score, value, mean, z=round(z, 3),
                            std=round(std, 4), mean=round(mean, 4))

    def _dir_ok(self, delta: float) -> bool:
        if self.direction == "up":
            return delta > 0
        if self.direction == "down":
            return delta < 0
        return True
