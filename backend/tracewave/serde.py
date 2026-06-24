"""JSON (de)serialization helpers.

Uses ``orjson`` when available (fast path for the hot streaming loop) and falls
back to the stdlib ``json`` module so the package still imports in a minimal env.
"""

from __future__ import annotations

from typing import Any

try:
    import orjson

    def dumps(obj: Any) -> bytes:
        return orjson.dumps(obj)

    def loads(data: Any) -> Any:
        return orjson.loads(data)

except Exception:  # pragma: no cover - fallback path
    import json

    def dumps(obj: Any) -> bytes:
        return json.dumps(obj, separators=(",", ":")).encode()

    def loads(data: Any) -> Any:
        if isinstance(data, (bytes, bytearray)):
            data = data.decode()
        return json.loads(data)


def dumps_str(obj: Any) -> str:
    out = dumps(obj)
    return out.decode() if isinstance(out, (bytes, bytearray)) else out
