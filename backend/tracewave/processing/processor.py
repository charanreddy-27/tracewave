"""Stream processor core (transport-agnostic).

Folds events into tumbling windows, runs every detector on each completed
window, asks the ensemble for a verdict, and emits results through two async
callbacks. The same core powers both single-process dev mode and the distributed
Compose stack — only the callbacks differ (in-memory hub vs Timescale + Redis).
"""

from __future__ import annotations

import asyncio
import time
from typing import Awaitable, Callable, List, Optional

from tracewave import metrics as M
from tracewave.config import Settings
from tracewave.models import Anomaly, DetectorResult, Event, MetricSnapshot
from tracewave.processing.detectors import (
    Ensemble,
    EnsembleConfig,
    EwmaDetector,
    HalfSpaceTreesDetector,
    RollingZScore,
)
from tracewave.processing.features import DimBaseline
from tracewave.processing.windows import TumblingAggregator

MetricCb = Callable[[MetricSnapshot, List[DetectorResult]], Awaitable[None]]
AnomalyCb = Callable[[Anomaly], Awaitable[None]]


class Processor:
    def __init__(self, settings: Settings, on_metric: MetricCb, on_anomaly: AnomalyCb) -> None:
        self.s = settings
        self.on_metric = on_metric
        self.on_anomaly = on_anomaly
        self.primary = settings.primary_metric

        self.agg = TumblingAggregator(tick_seconds=settings.tick_seconds)
        self.detectors = [
            RollingZScore(window=settings.zscore_window,
                          threshold=settings.zscore_threshold,
                          direction=settings.detector_direction),
            EwmaDetector(alpha=settings.ewma_alpha,
                         threshold=settings.ewma_threshold,
                         direction=settings.detector_direction),
            HalfSpaceTreesDetector(threshold=settings.hst_threshold),
        ]
        self.ensemble = Ensemble(EnsembleConfig())
        self.baseline = DimBaseline()
        # serialise event-processing and clock-ticks so they never interleave
        # mid-emit (both mutate the aggregator, detectors and baseline).
        self._lock = asyncio.Lock()

        # self-metrics
        self.events_seen = 0
        self.snapshots = 0
        self.anomalies = 0
        self.last_rate = 0.0
        self._last_event_ts: Optional[float] = None

    async def process_event(self, ev: Event, now: Optional[float] = None) -> None:
        self.events_seen += 1
        self._last_event_ts = ev.ts
        M.EVENTS_PROCESSED.inc()
        async with self._lock:
            for snap in self.agg.add(ev, now=now):
                await self._emit(snap)

    async def tick(self, now: Optional[float] = None) -> None:
        """Advance the clock so quiet periods still emit (rate=0) windows."""
        now = now if now is not None else time.time()
        async with self._lock:
            for snap in self.agg.tick_to(now):
                await self._emit(snap)

    async def _emit(self, snap: MetricSnapshot) -> None:
        t0 = time.perf_counter()
        self.snapshots += 1
        self.last_rate = snap.rate
        M.SNAPSHOTS.inc()
        M.RATE_GAUGE.set(snap.rate)
        if self._last_event_ts is not None:
            M.LAG_GAUGE.set(max(0.0, time.time() - snap.window_end))

        value = snap.metrics.get(self.primary, snap.rate)
        results: List[DetectorResult] = [
            d.update(value, features=snap.metrics) for d in self.detectors
        ]
        for r in results:
            if r.flag:
                M.DETECTOR_FIRED.labels(r.name).inc()

        # "why" breakdown must compare against history *excluding* this window.
        why = self.baseline.breakdown(snap)
        self.baseline.update(snap.dim_counts)

        anomaly = self.ensemble.evaluate(
            self.primary, value, results,
            ts=snap.window_end, window_start=snap.window_start,
            window_end=snap.window_end, why=why,
        )

        await self.on_metric(snap, results)
        if anomaly is not None:
            self.anomalies += 1
            M.ANOMALIES.labels(anomaly.severity).inc()
            await self.on_anomaly(anomaly)

        M.PROCESS_TIME.observe(time.perf_counter() - t0)

    def stats(self) -> dict:
        return {
            "events_seen": self.events_seen,
            "snapshots": self.snapshots,
            "anomalies": self.anomalies,
            "last_rate": round(self.last_rate, 3),
            "detectors": [
                {"name": d.name, "available": getattr(d, "available", True)}
                for d in self.detectors
            ],
        }
