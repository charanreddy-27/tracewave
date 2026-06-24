"""Detector interface."""

from __future__ import annotations

import math
from typing import Dict, Optional

from tracewave.models import DetectorResult


def logistic(x: float) -> float:
    """Numerically-stable logistic, maps R -> (0, 1)."""
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


class Detector:
    """Base class for online detectors.

    Detectors are stateful and updated one tick at a time. ``update`` returns the
    detector's verdict for that tick. Scalar detectors use ``value``; multivariate
    detectors (e.g. Half-Space Trees) use ``features``.
    """

    name: str = "base"
    available: bool = True  # set False when an optional dependency is missing

    def update(self, value: float, features: Optional[Dict[str, float]] = None) -> DetectorResult:
        raise NotImplementedError

    def _result(self, flag: bool, score: float, value: float, expected: float,
                **detail) -> DetectorResult:
        return DetectorResult(
            name=self.name,
            flag=flag,
            score=max(0.0, min(1.0, score)),
            value=value,
            expected=expected,
            detail=detail,
        )
