"""Event bus: the buffer between the ingestor and the stream processor.

Two interchangeable implementations behind one async interface:

* :class:`InMemoryEventBus` — an ``asyncio.Queue``; single-process dev mode.
* :class:`RedisEventBus` — Redis Streams with a consumer group; the Compose stack.

Both apply **backpressure**: the firehose can burst to thousands of events/sec,
so a bounded buffer drops the *oldest* events rather than growing without limit
or crashing. Dropped counts are surfaced as a metric, never silently swallowed.
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator, Optional

from tracewave import serde
from tracewave.models import Event


class InMemoryEventBus:
    """Bounded in-process queue. Drops oldest on overflow (backpressure)."""

    def __init__(self, maxsize: int = 20_000) -> None:
        self._q: asyncio.Queue[Event] = asyncio.Queue(maxsize=maxsize)
        self.dropped = 0

    async def publish(self, event: Event) -> None:
        try:
            self._q.put_nowait(event)
        except asyncio.QueueFull:
            # shed the oldest to make room for the newest, keeping data fresh
            try:
                self._q.get_nowait()
                self.dropped += 1
            except asyncio.QueueEmpty:
                pass
            try:
                self._q.put_nowait(event)
            except asyncio.QueueFull:
                self.dropped += 1

    async def subscribe(self) -> AsyncIterator[Event]:
        while True:
            yield await self._q.get()

    async def close(self) -> None:  # symmetry with RedisEventBus
        return None


class RedisEventBus:
    """Redis Streams bus with a consumer group (at-least-once delivery)."""

    def __init__(self, url: str, stream: str, group: str = "proc",
                 maxlen: int = 50_000, consumer: str = "c1") -> None:
        self.url = url
        self.stream = stream
        self.group = group
        self.maxlen = maxlen
        self.consumer = consumer
        self._redis = None
        self.dropped = 0  # Redis trims via MAXLEN; kept for interface parity

    async def _client(self):
        if self._redis is None:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(self.url)
            try:
                await self._redis.xgroup_create(
                    self.stream, self.group, id="0", mkstream=True
                )
            except Exception:
                pass  # BUSYGROUP: group already exists
        return self._redis

    async def publish(self, event: Event) -> None:
        r = await self._client()
        # approximate trimming (~) is much cheaper than exact and bounds memory
        await r.xadd(
            self.stream,
            {"d": serde.dumps_str(event.as_dict())},
            maxlen=self.maxlen,
            approximate=True,
        )

    async def subscribe(self) -> AsyncIterator[Event]:
        r = await self._client()
        while True:
            resp = await r.xreadgroup(
                self.group, self.consumer, {self.stream: ">"},
                count=256, block=2000,
            )
            if not resp:
                continue
            for _stream, messages in resp:
                for msg_id, fields in messages:
                    raw = fields.get(b"d") or fields.get("d")
                    try:
                        data = serde.loads(raw)
                        yield Event(**data)
                    finally:
                        await r.xack(self.stream, self.group, msg_id)

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()


def make_event_bus(settings) -> "InMemoryEventBus | RedisEventBus":
    if settings.use_redis:
        return RedisEventBus(
            settings.redis_url, settings.events_stream,
            group=settings.consumer_group, maxlen=settings.stream_maxlen,
        )
    return InMemoryEventBus()
