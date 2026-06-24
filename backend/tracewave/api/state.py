"""In-memory history buffer + WebSocket client fan-out.

The buffer gives every newly-connected dashboard an *instant* backfill (no blank
screen while it waits for the next tick) and is the history source in dev mode
when there is no TimescaleDB. A background pump task drains the live hub into the
buffer and broadcasts to all connected clients.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional, Set

log = logging.getLogger("tracewave.api")


class HistoryBuffer:
    def __init__(self, metrics_max: int = 900, anomalies_max: int = 200) -> None:
        self.metrics: Deque[Dict[str, Any]] = deque(maxlen=metrics_max)
        self.anomalies: Deque[Dict[str, Any]] = deque(maxlen=anomalies_max)

    def add_metric(self, m: Dict[str, Any]) -> None:
        self.metrics.append(m)

    def add_anomaly(self, a: Dict[str, Any]) -> None:
        self.anomalies.append(a)

    def recent_metrics(self, seconds: int) -> List[Dict[str, Any]]:
        if not self.metrics:
            return []
        cutoff = self.metrics[-1]["t"] - seconds
        return [m for m in self.metrics if m["t"] >= cutoff]

    def recent_anomalies(self, limit: int = 100) -> List[Dict[str, Any]]:
        return list(self.anomalies)[-limit:][::-1]  # newest first

    def incident(self, anomaly_id: str, pad: int = 60) -> Optional[Dict[str, Any]]:
        anom = next((a for a in self.anomalies if a["id"] == anomaly_id), None)
        if anom is None:
            return None
        lo, hi = anom["ts"] - pad, anom["ts"] + pad
        series = [m for m in self.metrics if lo <= m["t"] <= hi]
        return {"anomaly": anom, "series": series}


class ClientHub:
    """Tracks connected WebSockets and broadcasts messages to them."""

    def __init__(self) -> None:
        self._clients: Set[Any] = set()
        self._lock = asyncio.Lock()

    async def add(self, ws) -> None:
        async with self._lock:
            self._clients.add(ws)

    async def remove(self, ws) -> None:
        async with self._lock:
            self._clients.discard(ws)

    @property
    def count(self) -> int:
        return len(self._clients)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        if not self._clients:
            return
        dead = []
        for ws in list(self._clients):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.remove(ws)


class AppState:
    """Bundles everything a request handler needs."""

    def __init__(self, settings, live_hub, store, processor=None) -> None:
        self.settings = settings
        self.live_hub = live_hub
        self.store = store
        self.processor = processor
        self.buffer = HistoryBuffer(settings.history_buffer, settings.anomaly_buffer)
        self.clients = ClientHub()
        self.started_at = time.time()
        self._pump_task: Optional[asyncio.Task] = None
        # lightweight self-rate estimate from the metric stream
        self._last_rate = 0.0

    async def start_pump(self) -> None:
        self._pump_task = asyncio.create_task(self._pump())

    async def stop_pump(self) -> None:
        if self._pump_task:
            self._pump_task.cancel()
            try:
                await self._pump_task
            except asyncio.CancelledError:
                pass

    async def _pump(self) -> None:
        async for kind, payload in self.live_hub.subscribe():
            try:
                if kind == "metric":
                    self.buffer.add_metric(payload)
                    self._last_rate = payload.get("rate", self._last_rate)
                else:
                    self.buffer.add_anomaly(payload)
                await self.clients.broadcast(payload)
            except Exception:  # never let one bad message kill the pump
                log.exception("pump: failed to dispatch message")

    # --- history helpers (store-backed when available, else memory) ------- #
    async def history(self, seconds: int) -> Dict[str, Any]:
        if getattr(self.store, "enabled", False):
            metrics = await self.store.recent_metrics(seconds)
            anomalies = await self.store.recent_anomalies(self.settings.anomaly_buffer)
        else:
            metrics = self.buffer.recent_metrics(seconds)
            anomalies = self.buffer.recent_anomalies(self.settings.anomaly_buffer)
        return {"metrics": metrics, "anomalies": anomalies}

    async def incident(self, anomaly_id: str) -> Optional[Dict[str, Any]]:
        if getattr(self.store, "enabled", False):
            return await self.store.incident(anomaly_id)
        return self.buffer.incident(anomaly_id)
