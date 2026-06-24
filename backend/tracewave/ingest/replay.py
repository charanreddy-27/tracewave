"""Record + replay support.

* :class:`EventRecorder` tees the live stream to a JSONL file so an interesting
  moment can be re-watched exactly (the "replayable incidents" angle), and so the
  demo always has real data to fall back on when offline.
* :func:`replay_events` reads such a file and yields events paced like the
  original timeline (or fast-forwarded via ``speed``). It loops forever so a demo
  link is never empty.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import AsyncIterator, Optional

from tracewave import serde
from tracewave.models import Event


class EventRecorder:
    def __init__(self, path: str, max_bytes: int = 50_000_000) -> None:
        self.path = path
        self.max_bytes = max_bytes
        self._fh = None

    def _open(self):
        if self._fh is None:
            os.makedirs(os.path.dirname(os.path.abspath(self.path)) or ".", exist_ok=True)
            self._fh = open(self.path, "ab")
        return self._fh

    def write(self, ev: Event) -> None:
        fh = self._open()
        fh.write(serde.dumps(ev.as_dict()) + b"\n")
        if fh.tell() > self.max_bytes:
            fh.flush()
            fh.close()
            self._fh = None  # rotate by truncation on next open is overkill; just reopen append

    def close(self) -> None:
        if self._fh is not None:
            self._fh.flush()
            self._fh.close()
            self._fh = None


async def replay_events(
    path: str,
    speed: float = 1.0,
    loop: bool = True,
    retime: bool = True,
) -> AsyncIterator[Event]:
    """Yield recorded events, pacing by inter-event gaps / ``speed``.

    ``retime`` rewrites event timestamps to *now* so detectors and charts see a
    fresh, present-tense timeline on every replay pass.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    while True:
        prev_ts: Optional[float] = None
        wall0 = time.time()
        base_ts: Optional[float] = None
        with open(path, "rb") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    ev = Event(**serde.loads(line))
                except Exception:
                    continue
                if base_ts is None:
                    base_ts = ev.ts
                if prev_ts is not None and speed > 0:
                    gap = max(0.0, ev.ts - prev_ts) / speed
                    if gap > 0:
                        await asyncio.sleep(min(gap, 5.0))
                prev_ts = ev.ts
                if retime:
                    # map original timeline onto wall clock starting now
                    ev.ts = wall0 + (ev.ts - base_ts) / max(speed, 1e-9)
                yield ev
        if not loop:
            return
