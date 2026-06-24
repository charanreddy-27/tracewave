"""Ingestor service: firehose -> bus. `python -m tracewave.run.ingestor`."""

from __future__ import annotations

import asyncio

from tracewave import metrics as M
from tracewave.bus import make_event_bus
from tracewave.config import get_settings
from tracewave.ingest.replay import EventRecorder
from tracewave.ingest.runner import IngestRunner
from tracewave.run.common import configure_logging


async def main() -> None:
    configure_logging()
    settings = get_settings()
    M.start_server(settings.metrics_port)
    bus = make_event_bus(settings)
    recorder = EventRecorder(settings.record_file) if settings.record_file else None
    runner = IngestRunner(settings, bus, recorder)
    try:
        await runner.run()
    finally:
        if recorder is not None:
            recorder.close()
        await bus.close()


if __name__ == "__main__":
    asyncio.run(main())
