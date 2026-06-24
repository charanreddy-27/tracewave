"""Ingest runner: firehose (or replay) -> normalise -> publish to the bus.

Robust to the firehose dropping out: reconnects with exponential backoff and
resumes from the last SSE id, so the demo survives network blips. Optional
per-second cap sheds load before it ever reaches the bus.
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from typing import Optional

import httpx

from tracewave import metrics as M
from tracewave.config import Settings
from tracewave.ingest.replay import EventRecorder, replay_events
from tracewave.ingest.sse import iter_sse
from tracewave.ingest.sources import get_source

log = logging.getLogger("tracewave.ingest")


class IngestRunner:
    def __init__(self, settings: Settings, bus, recorder: Optional[EventRecorder] = None) -> None:
        self.s = settings
        self.bus = bus
        self.recorder = recorder
        self._sec_bucket = 0
        self._sec_count = 0

    async def run(self) -> None:
        if self.s.replay_file:
            log.info("ingest: replay mode from %s", self.s.replay_file)
            await self._run_replay()
        else:
            await self._run_live()

    # ------------------------------------------------------------------ #
    async def _publish(self, ev) -> None:
        if self.s.max_events_per_sec > 0:
            sec = int(time.time())
            if sec != self._sec_bucket:
                self._sec_bucket = sec
                self._sec_count = 0
            self._sec_count += 1
            if self._sec_count > self.s.max_events_per_sec:
                M.EVENTS_DROPPED.inc()
                return
        M.EVENTS_INGESTED.inc()
        if self.recorder is not None:
            try:
                self.recorder.write(ev)
            except Exception:
                pass
        await self.bus.publish(ev)

    # ------------------------------------------------------------------ #
    async def _run_replay(self) -> None:
        async for ev in replay_events(self.s.replay_file, speed=self.s.replay_speed):
            await self._publish(ev)

    async def _run_live(self) -> None:
        source = get_source(self.s.source)
        url = self.s.sse_url or source.default_url
        last_id: Optional[str] = None
        attempt = 0
        log.info("ingest: connecting to %s (%s)", url, source.name)

        headers = {"User-Agent": self.s.user_agent}
        async with httpx.AsyncClient(follow_redirects=True, headers=headers) as client:
            while True:
                try:
                    async for event_id, data in iter_sse(client, url, last_id=last_id):
                        last_id = event_id or last_id
                        ev = source.parse(data)
                        if ev is not None:
                            await self._publish(ev)
                        attempt = 0  # healthy: reset backoff
                except asyncio.CancelledError:
                    raise
                except Exception as exc:  # noqa: BLE001 - reconnect on anything
                    attempt += 1
                    backoff = min(30.0, (2 ** min(attempt, 5)) + 0.1 * attempt)
                    log.warning("ingest: stream error (%s); reconnecting in %.1fs",
                                exc, backoff)
                    await asyncio.sleep(backoff)
