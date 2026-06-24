"""Minimal async Server-Sent-Events line reader built on httpx.

Yields ``(event_id, data)`` for each SSE event. Tracks ``id:`` so the caller can
resume from ``Last-Event-ID`` after a reconnect (Wikimedia supports this), which
avoids gaps in the stream when the connection blips mid-demo.
"""

from __future__ import annotations

from typing import AsyncIterator, Optional, Tuple

import httpx


async def iter_sse(
    client: httpx.AsyncClient,
    url: str,
    last_id: Optional[str] = None,
    timeout: float = 60.0,
) -> AsyncIterator[Tuple[Optional[str], str]]:
    headers = {"Accept": "text/event-stream"}
    if last_id:
        headers["Last-Event-ID"] = last_id

    async with client.stream("GET", url, headers=headers, timeout=timeout) as resp:
        resp.raise_for_status()
        event_id: Optional[str] = last_id
        data_lines: list[str] = []
        async for line in resp.aiter_lines():
            if line == "":
                # blank line terminates an event
                if data_lines:
                    yield event_id, "\n".join(data_lines)
                    data_lines = []
                continue
            if line.startswith(":"):
                continue  # comment / keep-alive
            field, _, value = line.partition(":")
            if value.startswith(" "):
                value = value[1:]
            if field == "data":
                data_lines.append(value)
            elif field == "id":
                event_id = value
            # "event" and "retry" fields are ignored for this use-case
