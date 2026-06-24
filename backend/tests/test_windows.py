"""Windowing math: counts, rates, continuous (gap-filled) series, dim counts."""

from tracewave.models import Event
from tracewave.processing.windows import TumblingAggregator


def ev(ts, subject="A", actor="u", bot=False, kind="edit", bytes_delta=10,
       domain="en.wikipedia.org", lang="en", namespace="0"):
    return Event(
        ts=ts, source="test", id=f"{subject}-{actor}-{ts}", kind=kind,
        actor=actor, subject=subject, bot=bot, bytes_delta=bytes_delta,
        weight=abs(bytes_delta),
        dims={"domain": domain, "lang": lang, "kind": kind, "namespace": namespace},
    )


def test_basic_count_and_rate():
    agg = TumblingAggregator(tick_seconds=1.0)
    # three events in window [100,101), driven by processing clock `now`
    for _ in range(3):
        assert agg.add(ev(100.0), now=100.2) == []
    # cross into next window -> the [100,101) window completes
    snaps = agg.add(ev(101.0), now=101.1)
    assert len(snaps) == 1
    s = snaps[0]
    assert s.window_start == 100.0 and s.window_end == 101.0
    assert s.count == 3
    assert s.rate == 3.0
    assert s.metrics["rate"] == 3.0


def test_distinct_and_bot_and_bytes():
    agg = TumblingAggregator(tick_seconds=1.0)
    agg.add(ev(10.0, subject="P1", actor="alice", bytes_delta=100), now=10.0)
    agg.add(ev(10.0, subject="P1", actor="bob", bot=True, bytes_delta=-50), now=10.1)
    agg.add(ev(10.0, subject="P2", actor="alice", bytes_delta=20), now=10.2)
    snaps = agg.tick_to(11.5)
    assert len(snaps) == 1
    s = snaps[0]
    assert s.count == 3
    assert s.distinct_subjects == 2          # P1, P2
    assert s.distinct_actors == 2            # alice, bob
    assert s.bot_count == 1
    assert s.bytes_changed == 170            # |100| + |-50| + |20|
    assert abs(s.metrics["bot_ratio"] - 1 / 3) < 1e-9


def test_empty_windows_are_emitted_for_gaps():
    agg = TumblingAggregator(tick_seconds=1.0)
    agg.add(ev(0.0), now=0.5)
    # jump 4 seconds: window 0 completes plus empty windows 1,2,3
    snaps = agg.add(ev(4.0), now=4.5)
    assert [s.window_start for s in snaps] == [0.0, 1.0, 2.0, 3.0]
    assert snaps[0].count == 1
    assert all(s.count == 0 and s.rate == 0.0 for s in snaps[1:])


def test_tick_to_flushes_without_events():
    agg = TumblingAggregator(tick_seconds=2.0)
    agg.add(ev(0.0), now=0.0)
    snaps = agg.tick_to(5.0)  # windows [0,2) and [2,4) complete
    assert [s.window_start for s in snaps] == [0.0, 2.0]
    assert snaps[0].count == 1
    assert snaps[1].count == 0


def test_dim_counts_topk():
    agg = TumblingAggregator(tick_seconds=1.0, dim_topk=2)
    for _ in range(5):
        agg.add(ev(0.0, domain="en.wikipedia.org"), now=0.0)
    for _ in range(3):
        agg.add(ev(0.0, domain="de.wikipedia.org"), now=0.0)
    agg.add(ev(0.0, domain="fr.wikipedia.org"), now=0.0)
    snaps = agg.tick_to(1.5)
    domain_counts = snaps[0].dim_counts["domain"]
    assert len(domain_counts) == 2                  # top-2 only
    assert domain_counts["en.wikipedia.org"] == 5
    assert domain_counts["de.wikipedia.org"] == 3


def test_late_event_folds_into_current_window():
    agg = TumblingAggregator(tick_seconds=1.0)
    agg.add(ev(0.0), now=0.5)
    # an out-of-order event arrives but clock says we're still in window 0
    agg.add(ev(0.0), now=0.9)
    snaps = agg.tick_to(1.5)
    assert snaps[0].count == 2
