"""Normalise Wikimedia EventStreams `recentchange` events into `Event`.

Every Wikipedia (and sister-project) edit on Earth, as SSE, no API key. See
https://stream.wikimedia.org/v2/stream/recentchange
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from tracewave import serde
from tracewave.models import Event

SOURCE = "wikimedia"


def _lang_from_domain(domain: str) -> str:
    # "en.wikipedia.org" -> "en", "commons.wikimedia.org" -> "commons"
    return domain.split(".", 1)[0] if domain else "?"


def parse(raw: str | bytes | Dict[str, Any]) -> Optional[Event]:
    """Parse one SSE data payload into an Event, or None if unusable."""
    try:
        obj = raw if isinstance(raw, dict) else serde.loads(raw)
    except Exception:
        return None
    if not isinstance(obj, dict):
        return None

    meta = obj.get("meta") or {}
    server_name = obj.get("server_name") or meta.get("domain") or "?"
    length = obj.get("length") or {}
    old_len = length.get("old")
    new_len = length.get("new")
    bytes_delta = 0
    if isinstance(new_len, (int, float)):
        bytes_delta = int(new_len) - int(old_len or 0)

    ts = obj.get("timestamp")
    try:
        ts = float(ts)
    except (TypeError, ValueError):
        ts = time.time()

    bot = bool(obj.get("bot"))
    kind = obj.get("type") or "edit"
    ev_id = str(meta.get("id") or obj.get("id") or f"{server_name}-{ts}")

    return Event(
        ts=ts,
        source=SOURCE,
        id=ev_id,
        kind=kind,
        actor=str(obj.get("user") or "?"),
        subject=str(obj.get("title") or "?"),
        bot=bot,
        bytes_delta=bytes_delta,
        weight=float(abs(bytes_delta)),
        dims={
            "domain": server_name,
            "lang": _lang_from_domain(server_name),
            "kind": kind,
            "namespace": str(obj.get("namespace", "?")),
            "user_type": "bot" if bot else "human",
        },
    )
