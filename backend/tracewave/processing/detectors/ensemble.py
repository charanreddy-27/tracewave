"""Combine detector verdicts into a single anomaly with a confidence score.

Design: confidence rewards *agreement*. Each available detector contributes its
score; the ensemble confidence is the summed score of the detectors that fired,
divided by the number of *available* detectors. So:

* 3/3 detectors firing at 0.8  -> 0.80 confidence (strong, corroborated)
* 1/3 detectors firing at 0.8  -> 0.27 confidence (suppressed unless very strong)
* 1/1 detectors firing at 0.9  -> 0.90 confidence (single-detector MVP mode)

This naturally encodes the "detectors that agree are more trustworthy" intuition
while still letting a single, very strong signal surface.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import List, Optional, Sequence

from tracewave.models import Anomaly, Contribution, DetectorResult


@dataclass
class EnsembleConfig:
    min_confidence: float = 0.5       # below this -> not an anomaly
    strong_single: float = 0.92       # a lone detector this strong surfaces anyway
    warn_at: float = 0.65
    critical_at: float = 0.85
    cooldown_seconds: float = 4.0     # suppress repeat anomalies on the same metric


class Ensemble:
    def __init__(self, config: Optional[EnsembleConfig] = None) -> None:
        self.cfg = config or EnsembleConfig()
        self._last_fired: dict[str, float] = {}

    def evaluate(
        self,
        metric: str,
        value: float,
        results: Sequence[DetectorResult],
        ts: float,
        window_start: float,
        window_end: float,
        why: Optional[List[Contribution]] = None,
    ) -> Optional[Anomaly]:
        available = [r for r in results if not r.detail.get("unavailable")]
        fired = [r for r in available if r.flag]
        if not available or not fired:
            return None

        n_avail = len(available)
        fired_sum = sum(r.score for r in fired)
        confidence = min(1.0, fired_sum / n_avail)
        max_fired = max(r.score for r in fired)

        surfaced = confidence >= self.cfg.min_confidence or max_fired >= self.cfg.strong_single
        if not surfaced:
            return None

        # Cooldown: don't spam one card per tick while a spike sustains.
        last = self._last_fired.get(metric, -1e9)
        if ts - last < self.cfg.cooldown_seconds:
            return None
        self._last_fired[metric] = ts

        # Expected value: average of the detectors' expectations (those that have one).
        exps = [r.expected for r in fired if r.expected is not None]
        expected = sum(exps) / len(exps) if exps else value

        score = confidence
        if max_fired >= self.cfg.strong_single and len(fired) >= 2:
            score = min(1.0, score + 0.05)  # corroborated strong signal
        severity = self._severity(score, len(fired), n_avail)

        return Anomaly(
            id=uuid.uuid4().hex[:12],
            ts=ts,
            metric=metric,
            value=value,
            expected=expected,
            severity=severity,
            score=round(score, 4),
            agreement=len(fired),
            detectors=list(results),
            why=list(why or []),
            window_start=window_start,
            window_end=window_end,
        )

    def _severity(self, score: float, n_fired: int, n_avail: int) -> str:
        # Full agreement escalates one step.
        full_agreement = n_avail >= 2 and n_fired == n_avail
        if score >= self.cfg.critical_at or (full_agreement and score >= self.cfg.warn_at):
            return "critical"
        if score >= self.cfg.warn_at or full_agreement:
            return "warn"
        return "info"
