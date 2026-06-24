"""Tumbling-window aggregation engine (pure stdlib).

The processor feeds normalised :class:`~tracewave.models.Event` objects into a
:class:`TumblingAggregator` and advances a clock. Whenever the clock crosses a
window boundary the aggregator emits one :class:`~tracewave.models.MetricSnapshot`
per completed window — *including empty windows* so the metric series stays
continuous (rate drops to 0 when the firehose goes quiet rather than leaving a
gap, which matters for both the charts and the detectors).

Windowing is done on a caller-supplied clock (processing time by default) so the
behaviour is fully deterministic and unit-testable: tests drive ``now`` directly.
"""

from __future__ import annotations

from collections import Counter, deque
from typing import Deque, Dict, Iterable, List, Optional, Tuple

from tracewave.models import Event, MetricSnapshot


class _Bucket:
    """Mutable accumulator for a single window."""

    __slots__ = ("start", "tick", "count", "bot_count", "new_count",
                 "bytes_changed", "_subjects", "_actors", "_dims")

    def __init__(self, start: float, tick: float, dims: Iterable[str]) -> None:
        self.start = start
        self.tick = tick
        self.count = 0
        self.bot_count = 0
        self.new_count = 0
        self.bytes_changed = 0
        self._subjects: set = set()
        self._actors: set = set()
        self._dims: Dict[str, Counter] = {d: Counter() for d in dims}

    def add(self, ev: Event) -> None:
        self.count += 1
        if ev.bot:
            self.bot_count += 1
        if ev.kind == "new":
            self.new_count += 1
        self.bytes_changed += abs(int(ev.bytes_delta))
        if ev.subject:
            self._subjects.add(ev.subject)
        if ev.actor:
            self._actors.add(ev.actor)
        for dim, counter in self._dims.items():
            val = ev.dims.get(dim)
            if val:
                counter[val] += 1

    def finalize(self, dim_topk: int) -> MetricSnapshot:
        rate = self.count / self.tick if self.tick else 0.0
        distinct_subjects = len(self._subjects)
        distinct_actors = len(self._actors)
        bot_ratio = (self.bot_count / self.count) if self.count else 0.0
        metrics = {
            "rate": rate,
            "count": float(self.count),
            "distinct_subjects": float(distinct_subjects),
            "distinct_actors": float(distinct_actors),
            "bot_ratio": bot_ratio,
            "bytes_per_sec": self.bytes_changed / self.tick if self.tick else 0.0,
            "new_rate": self.new_count / self.tick if self.tick else 0.0,
        }
        dim_counts = {
            dim: dict(counter.most_common(dim_topk))
            for dim, counter in self._dims.items()
        }
        return MetricSnapshot(
            window_start=self.start,
            window_end=self.start + self.tick,
            tick_seconds=self.tick,
            count=self.count,
            rate=rate,
            distinct_subjects=distinct_subjects,
            distinct_actors=distinct_actors,
            bot_count=self.bot_count,
            new_count=self.new_count,
            bytes_changed=self.bytes_changed,
            metrics=metrics,
            dim_counts=dim_counts,
        )


class TumblingAggregator:
    """Fixed-width tumbling windows over a monotonically advancing clock.

    Parameters
    ----------
    tick_seconds:
        Window width in seconds.
    track_dims:
        Categorical dimension names to keep per-value counts for (drives the
        anomaly "why" breakdown). Defaults to Wikimedia-style dims.
    dim_topk:
        Keep only the top-K values per dimension in each snapshot to bound size.
    """

    def __init__(
        self,
        tick_seconds: float = 1.0,
        track_dims: Optional[Iterable[str]] = None,
        dim_topk: int = 15,
    ) -> None:
        self.tick = float(tick_seconds)
        self.track_dims: Tuple[str, ...] = tuple(
            track_dims if track_dims is not None
            else ("domain", "lang", "kind", "namespace", "user_type")
        )
        self.dim_topk = dim_topk
        self._bid: Optional[int] = None
        self._acc: Optional[_Bucket] = None

    def _bucket_id(self, t: float) -> int:
        return int(t // self.tick)

    def _new_bucket(self, bid: int) -> _Bucket:
        return _Bucket(bid * self.tick, self.tick, self.track_dims)

    def add(self, ev: Event, now: Optional[float] = None) -> List[MetricSnapshot]:
        """Add an event; return any windows that completed *before* this event."""
        t = now if now is not None else ev.ts
        bid = self._bucket_id(t)
        completed: List[MetricSnapshot] = []
        if self._bid is None:
            self._bid = bid
            self._acc = self._new_bucket(bid)
        elif bid > self._bid:
            completed = self._roll_to(bid)
        # Late event (bid < current): fold into the current window rather than drop,
        # so no real event is lost. Out-of-order tolerance for a live stream.
        self._acc.add(ev)  # type: ignore[union-attr]
        return completed

    def tick_to(self, now: float) -> List[MetricSnapshot]:
        """Advance the clock with no event; flush any windows that completed.

        Lets the processor emit ``rate=0`` windows during quiet periods so the
        series never freezes on the last value.
        """
        if self._bid is None:
            return []
        bid = self._bucket_id(now)
        if bid > self._bid:
            return self._roll_to(bid)
        return []

    def _roll_to(self, target_bid: int) -> List[MetricSnapshot]:
        assert self._acc is not None and self._bid is not None
        snaps = [self._acc.finalize(self.dim_topk)]
        # Emit empty windows for the gap so the series is continuous.
        for b in range(self._bid + 1, target_bid):
            snaps.append(self._new_bucket(b).finalize(self.dim_topk))
        self._bid = target_bid
        self._acc = self._new_bucket(target_bid)
        return snaps


class RingBuffer:
    """Fixed-size recent-history buffer (for replaying state to new clients)."""

    def __init__(self, maxlen: int = 600) -> None:
        self._buf: Deque = deque(maxlen=maxlen)

    def push(self, item) -> None:
        self._buf.append(item)

    def items(self) -> List:
        return list(self._buf)

    def __len__(self) -> int:
        return len(self._buf)
