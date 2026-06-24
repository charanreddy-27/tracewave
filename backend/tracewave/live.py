"""Live broadcast hub: pushes metric ticks and anomalies to dashboard clients.

* :class:`InMemoryLiveHub` — fan-out to local subscriber queues; used when the
  processor and API share a process (single-process dev mode).
* :class:`RedisLiveHub` — Redis pub/sub; the processor publishes, the (separate)
  API process subscribes and forwards over WebSockets.

A "message" is a ``(kind, payload)`` pair where ``kind`` is ``"metric"`` or
``"anomaly"``. Slow WebSocket clients can't stall the pipeline: per-subscriber
queues are bounded and drop on overflow.
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator, Dict, List, Set, Tuple

from tracewave import serde

Message = Tuple[str, dict]


class InMemoryLiveHub:
    def __init__(self, sub_maxsize: int = 1000) -> None:
        self._subs: Set[asyncio.Queue] = set()
        self._sub_maxsize = sub_maxsize

    async def publish_metric(self, payload: dict) -> None:
        self._fanout(("metric", payload))

    async def publish_anomaly(self, payload: dict) -> None:
        self._fanout(("anomaly", payload))

    def _fanout(self, msg: Message) -> None:
        for q in self._subs:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()       # drop oldest for a lagging client
                    q.put_nowait(msg)
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    pass

    async def subscribe(self) -> AsyncIterator[Message]:
        q: asyncio.Queue = asyncio.Queue(maxsize=self._sub_maxsize)
        self._subs.add(q)
        try:
            while True:
                yield await q.get()
        finally:
            self._subs.discard(q)

    async def close(self) -> None:
        return None


class RedisLiveHub:
    def __init__(self, url: str, metrics_channel: str, anomalies_channel: str) -> None:
        self.url = url
        self.metrics_channel = metrics_channel
        self.anomalies_channel = anomalies_channel
        self._redis = None

    async def _client(self):
        if self._redis is None:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(self.url)
        return self._redis

    async def publish_metric(self, payload: dict) -> None:
        r = await self._client()
        await r.publish(self.metrics_channel, serde.dumps_str(payload))

    async def publish_anomaly(self, payload: dict) -> None:
        r = await self._client()
        await r.publish(self.anomalies_channel, serde.dumps_str(payload))

    async def subscribe(self) -> AsyncIterator[Message]:
        r = await self._client()
        pubsub = r.pubsub()
        await pubsub.subscribe(self.metrics_channel, self.anomalies_channel)
        kind_for = {
            self.metrics_channel.encode(): "metric",
            self.anomalies_channel.encode(): "anomaly",
        }
        async for msg in pubsub.listen():
            if msg.get("type") != "message":
                continue
            channel = msg["channel"]
            kind = kind_for.get(channel, "metric")
            yield kind, serde.loads(msg["data"])

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()


def make_live_hub(settings):
    if settings.use_redis:
        return RedisLiveHub(
            settings.redis_url, settings.metrics_channel, settings.anomalies_channel
        )
    return InMemoryLiveHub()
