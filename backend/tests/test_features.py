"""DimBaseline breakdown — the anomaly "why" evidence."""

from tracewave.models import MetricSnapshot
from tracewave.processing.features import DimBaseline


def snap(dim_counts):
    return MetricSnapshot(
        window_start=0.0, window_end=1.0, tick_seconds=1.0, count=0, rate=0.0,
        distinct_subjects=0, distinct_actors=0, bot_count=0, new_count=0,
        bytes_changed=0, metrics={}, dim_counts=dim_counts,
    )


def test_breakdown_identifies_the_spiking_slice():
    base = DimBaseline(alpha=0.5)
    # establish a baseline where en is steady at ~10
    for _ in range(20):
        base.update({"domain": {"en.wikipedia.org": 10, "de.wikipedia.org": 5}})

    # now en surges to 200
    s = snap({"domain": {"en.wikipedia.org": 200, "de.wikipedia.org": 5}})
    contribs = base.breakdown(s, top_n=5)

    assert contribs                       # something is anomalous
    top = contribs[0]
    assert top.dim == "domain"
    assert top.value == "en.wikipedia.org"
    assert top.observed == 200
    assert top.excess > 150
    assert top.share > 0.5                # explains most of the excess


def test_breakdown_empty_when_within_baseline():
    base = DimBaseline(alpha=0.5)
    for _ in range(20):
        base.update({"domain": {"en.wikipedia.org": 10}})
    s = snap({"domain": {"en.wikipedia.org": 11}})  # basically normal
    assert base.breakdown(s, min_excess=5.0) == []


def test_breakdown_shares_sum_to_one():
    base = DimBaseline(alpha=0.5)
    for _ in range(10):
        base.update({"domain": {"a": 1, "b": 1}})
    s = snap({"domain": {"a": 100, "b": 60}})
    contribs = base.breakdown(s, top_n=10)
    assert abs(sum(c.share for c in contribs) - 1.0) < 1e-6
