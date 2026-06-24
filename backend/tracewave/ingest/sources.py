"""Source registry — makes the pipeline data-agnostic / switchable.

Adding a second firehose (the stretch goal) is just one entry here: a default
SSE URL plus a ``parse`` function that returns an :class:`~tracewave.models.Event`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from tracewave.ingest import wikimedia
from tracewave.models import Event


@dataclass
class SourceSpec:
    name: str
    default_url: str
    parse: Callable[[Any], Optional[Event]]


REGISTRY: Dict[str, SourceSpec] = {
    "wikimedia": SourceSpec(
        name="wikimedia",
        default_url="https://stream.wikimedia.org/v2/stream/recentchange",
        parse=wikimedia.parse,
    ),
}


def get_source(name: str) -> SourceSpec:
    try:
        return REGISTRY[name]
    except KeyError:
        raise ValueError(f"unknown source {name!r}; known: {list(REGISTRY)}")
