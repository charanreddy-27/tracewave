"""End-to-end: a synthetic spike through the full Processor must raise an
explained anomaly (windows -> detectors -> ensemble -> "why" breakdown -> callbacks).

Runs the async pipeline with ``asyncio.run`` so it needs only pytest (no plugins,
no Redis/Timescale/river).
"""

import asyncio

from tracewave.config import Settings
from tracewave.models import Event
from tracewave.processing.processor import Processor


def mk(now, domain, subject, actor, bot=False):
    return Event(
        ts=now, source="test", id=f"{subject}-{actor}-{now}", kind="edit",
        actor=actor, subject=subject, bot=bot, bytes_delta=50, weight=50,
        dims={"domain": domain, "lang": domain.split(".")[0], "kind": "edit",
              "namespace": "0", "user_type": "bot" if bot else "human"},
    )


async def _scenario():
    metrics, anomalies = [], []

    async def on_metric(snap, results):
        metrics.append((snap, results))

    async def on_anomaly(a):
        anomalies.append(a)

    s = Settings(zscore_window=60, zscore_threshold=3.0, ewma_threshold=3.0,
                 detector_direction="up", tick_seconds=1.0, redis_url="", pg_dsn="")
    p = Processor(s, on_metric, on_anomaly)

    base = 1000.0
    # 24 warmup windows of ~10 events/sec with mild variance and a spread of wikis
    for w in range(24):
        now = base + w
        n = 10 + (w % 5 - 2)  # 8..12 -> non-zero variance so z-scores are meaningful
        for i in range(n):
            await p.process_event(
                mk(now, domain=f"d{i % 5}.wikipedia.org", subject=f"P{i}", actor=f"u{i}"),
                now=now,
            )
        await p.tick(now + 1)  # close window w

    # spike window: 200 events, overwhelmingly from en.wikipedia.org
    sw = base + 24
    for i in range(200):
        await p.process_event(
            mk(sw, domain="en.wikipedia.org", subject=f"S{i}", actor=f"bot{i % 3}", bot=True),
            now=sw,
        )
    await p.tick(sw + 1)
    return metrics, anomalies


def test_full_pipeline_detects_and_explains_spike():
    metrics, anomalies = asyncio.run(_scenario())

    # warmup produced one snapshot per closed window
    assert len(metrics) >= 24

    assert anomalies, "the 200/sec spike should have raised an anomaly"
    a = anomalies[0]
    assert a.metric == "rate"
    assert a.value >= 150
    assert a.expected < 50               # baseline stayed near ~10
    assert a.agreement >= 2              # zscore AND ewma both fired
    assert a.severity == "critical"
    assert a.score >= 0.85

    # both univariate detectors flagged
    fired = {d.name for d in a.detectors if d.flag}
    assert {"zscore", "ewma"} <= fired

    # the "why" breakdown blames en.wikipedia.org as the dominant contributor
    domain_contribs = [c for c in a.why if c.dim == "domain"]
    assert domain_contribs
    top = max(domain_contribs, key=lambda c: c.excess)
    assert top.value == "en.wikipedia.org"
    assert top.share > 0.5
