"""Processor service: bus -> windows/detectors -> Timescale + live hub.

`python -m tracewave.run.processor`
"""

from __future__ import annotations

import asyncio

from tracewave import metrics as M
from tracewave.bus import make_event_bus
from tracewave.config import get_settings
from tracewave.live import make_live_hub
from tracewave.processing.processor import Processor
from tracewave.run.common import configure_logging, consume_loop, make_callbacks, tick_loop
from tracewave.storage import make_store


async def main() -> None:
    configure_logging()
    settings = get_settings()
    M.start_server(settings.metrics_port)
    bus = make_event_bus(settings)
    live_hub = make_live_hub(settings)
    store = make_store(settings)
    if getattr(store, "enabled", False):
        await store.connect()
        await store.init_schema()

    on_metric, on_anomaly = make_callbacks(store, live_hub)
    processor = Processor(settings, on_metric, on_anomaly)

    try:
        await asyncio.gather(
            consume_loop(bus, processor),
            tick_loop(processor, settings.tick_seconds),
        )
    finally:
        await bus.close()
        await live_hub.close()
        if getattr(store, "enabled", False):
            await store.close()


if __name__ == "__main__":
    asyncio.run(main())
