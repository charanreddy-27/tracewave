"""Shared wiring used by every service entrypoint."""

from __future__ import annotations

import asyncio
import logging

from tracewave import wire
from tracewave.processing.processor import Processor


def make_callbacks(store, live_hub):
    """Build the processor's two output callbacks.

    Both persist (no-op under NullStore) and publish to the live hub, so a metric
    tick reaches TimescaleDB and the dashboard from a single code path.
    """

    async def on_metric(snap, results):
        msg = wire.metric_message(snap, results)
        await store.insert_metric(msg)
        await live_hub.publish_metric(msg)

    async def on_anomaly(anom):
        msg = wire.anomaly_message(anom)
        await store.insert_anomaly(msg)
        await live_hub.publish_anomaly(msg)

    return on_metric, on_anomaly


async def consume_loop(bus, processor: Processor) -> None:
    async for ev in bus.subscribe():
        await processor.process_event(ev)


async def tick_loop(processor: Processor, tick_seconds: float) -> None:
    """Drive the wall clock so quiet periods still emit (rate=0) windows."""
    while True:
        await asyncio.sleep(tick_seconds)
        await processor.tick()


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
