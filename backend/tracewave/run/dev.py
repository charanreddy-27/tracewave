"""Single-process dev runner: ingest + processor + API in one event loop.

No Redis, no Postgres, no Docker required — the whole pipeline runs against the
*real* Wikimedia firehose with an in-memory bus and an in-memory history buffer.
This is the fastest way to see Tracewave alive and to verify behaviour locally.

    python -m tracewave.run.dev
"""

from __future__ import annotations

import asyncio

import uvicorn

from tracewave.api.main import create_app
from tracewave.bus import make_event_bus
from tracewave.config import get_settings
from tracewave.ingest.replay import EventRecorder
from tracewave.ingest.runner import IngestRunner
from tracewave.live import make_live_hub
from tracewave.processing.processor import Processor
from tracewave.run.common import configure_logging, consume_loop, make_callbacks, tick_loop
from tracewave.storage import make_store


async def main() -> None:
    configure_logging()
    settings = get_settings()

    bus = make_event_bus(settings)
    live_hub = make_live_hub(settings)
    store = make_store(settings)
    if getattr(store, "enabled", False):
        await store.connect()
        await store.init_schema()

    on_metric, on_anomaly = make_callbacks(store, live_hub)
    processor = Processor(settings, on_metric, on_anomaly)
    recorder = EventRecorder(settings.record_file) if settings.record_file else None
    runner = IngestRunner(settings, bus, recorder)

    # API shares the in-memory hub/store with the processor; dev owns store lifecycle.
    app = create_app(settings, live_hub=live_hub, store=store,
                     processor=processor, manage_store=False)
    config = uvicorn.Config(app, host=settings.api_host, port=settings.api_port,
                            log_level="info", loop="asyncio")
    server = uvicorn.Server(config)

    tasks = [
        asyncio.create_task(runner.run(), name="ingest"),
        asyncio.create_task(consume_loop(bus, processor), name="process"),
        asyncio.create_task(tick_loop(processor, settings.tick_seconds), name="tick"),
        asyncio.create_task(server.serve(), name="api"),
    ]
    try:
        await asyncio.gather(*tasks)
    finally:
        if recorder is not None:
            recorder.close()
        if getattr(store, "enabled", False):
            await store.close()


if __name__ == "__main__":
    asyncio.run(main())
