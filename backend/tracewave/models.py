"""Core domain model.

Deliberately dependency-free (stdlib ``dataclasses`` only) so the processing
core can be unit-tested without Redis, Postgres, pydantic or any I/O. The API
layer converts these to JSON via :func:`as_dict`.

The model is *source-agnostic*: a Wikimedia edit and a GitHub push both normalise
to an :class:`Event`. Arbitrary categorical dimensions live in ``dims`` so the
anomaly "why" breakdown works for any firehose without code changes.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List


# --------------------------------------------------------------------------- #
# Ingest model
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class Event:
    """A single normalised firehose event."""

    ts: float                      # event time, unix seconds
    source: str                    # firehose id, e.g. "wikimedia"
    id: str                        # source-unique id (for dedupe)
    kind: str                      # canonical kind: edit | new | log | categorize
    actor: str                     # who acted (username / id)
    subject: str                   # what was acted on (page title / repo)
    bot: bool = False              # automated actor?
    bytes_delta: int = 0           # signed size change
    weight: float = 1.0            # magnitude for weighted metrics (e.g. |bytes|)
    dims: Dict[str, str] = field(default_factory=dict)  # categorical dims for breakdown

    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)


# --------------------------------------------------------------------------- #
# Processing output
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class MetricSnapshot:
    """Aggregated metrics for one completed tumbling window."""

    window_start: float
    window_end: float
    tick_seconds: float
    count: int                                   # events in window
    rate: float                                  # events / second
    distinct_subjects: int
    distinct_actors: int
    bot_count: int
    new_count: int
    bytes_changed: int                           # sum |bytes_delta|
    metrics: Dict[str, float] = field(default_factory=dict)        # named scalars detectors run on
    dim_counts: Dict[str, Dict[str, int]] = field(default_factory=dict)  # {dim: {value: count}}

    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class DetectorResult:
    """One detector's verdict on one metric tick."""

    name: str
    flag: bool
    score: float                 # normalised 0..1 anomaly score
    value: float
    expected: float
    detail: Dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class Contribution:
    """One dimension value's contribution to an anomaly (the "why")."""

    dim: str
    value: str
    observed: int
    baseline: float
    excess: float                # observed - baseline
    share: float                 # fraction of the total excess this value explains

    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class Anomaly:
    """A detected anomaly, with evidence."""

    id: str
    ts: float
    metric: str
    value: float
    expected: float
    severity: str                # info | warn | critical
    score: float                 # ensemble confidence 0..1
    agreement: int               # how many detectors fired
    detectors: List[DetectorResult] = field(default_factory=list)
    why: List[Contribution] = field(default_factory=list)
    window_start: float = 0.0
    window_end: float = 0.0

    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)
