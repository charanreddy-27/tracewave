"""FastAPI application: REST history + live WebSocket feed + Prometheus.

Can be constructed two ways:

* ``create_app()`` with no args — standalone API process (Compose stack). Builds
  its own Redis live-hub subscriber and TimescaleDB store from settings.
* ``create_app(settings, live_hub, store, processor)`` — single-process dev mode,
  sharing the in-memory hub/store with the processor running in the same loop.
"""

from __future__ import annotations

import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from tracewave import metrics as M
from tracewave.api.state import AppState
from tracewave.config import Settings, get_settings
from tracewave.live import make_live_hub
from tracewave.storage import make_store


def create_app(settings: Settings = None, live_hub=None, store=None, processor=None,
               manage_store: bool = True) -> FastAPI:
    settings = settings or get_settings()
    live_hub = live_hub if live_hub is not None else make_live_hub(settings)
    store = store if store is not None else make_store(settings)

    app = FastAPI(title="Tracewave API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    state = AppState(settings, live_hub, store, processor)
    app.state.tw = state

    @app.on_event("startup")
    async def _startup() -> None:
        if manage_store and getattr(store, "enabled", False):
            await store.connect()
            await store.init_schema()
        await state.start_pump()

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        await state.stop_pump()
        if manage_store and getattr(store, "enabled", False):
            await store.close()

    # ------------------------------------------------------------------ #
    @app.get("/api/health")
    async def health() -> dict:
        return {
            "status": "ok",
            "source": settings.source,
            "redis": settings.use_redis,
            "postgres": settings.use_postgres,
            "clients": state.clients.count,
            "uptime_s": round(time.time() - state.started_at, 1),
        }

    @app.get("/api/stats")
    async def stats() -> dict:
        out = {
            "events_per_sec": round(state._last_rate, 2),
            "clients": state.clients.count,
            "buffered_metrics": len(state.buffer.metrics),
            "buffered_anomalies": len(state.buffer.anomalies),
            "uptime_s": round(time.time() - state.started_at, 1),
        }
        if processor is not None:
            out["pipeline"] = processor.stats()
        return out

    @app.get("/api/history")
    async def history(seconds: int = 900) -> dict:
        seconds = max(1, min(seconds, settings.history_seconds))
        return await state.history(seconds)

    @app.get("/api/anomalies")
    async def anomalies(limit: int = 50) -> dict:
        data = await state.history(settings.history_seconds)
        return {"anomalies": data["anomalies"][:limit]}

    @app.get("/api/incident/{anomaly_id}")
    async def incident(anomaly_id: str):
        result = await state.incident(anomaly_id)
        if result is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        return result

    @app.get("/metrics")
    async def prometheus() -> Response:
        body, content_type = M.render()
        return Response(content=body, media_type=content_type)

    # ------------------------------------------------------------------ #
    @app.websocket("/ws")
    async def ws(websocket: WebSocket) -> None:
        await websocket.accept()
        await state.clients.add(websocket)
        try:
            # instant backfill so the dashboard renders immediately
            await websocket.send_json({
                "type": "snapshot",
                "server_time": time.time(),
                "tick_seconds": settings.tick_seconds,
                "source": settings.source,
                "metrics": list(state.buffer.metrics),
                "anomalies": state.buffer.recent_anomalies(settings.anomaly_buffer),
            })
            while True:
                # we don't expect client messages; this keeps the socket alive and
                # surfaces disconnects promptly
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            await state.clients.remove(websocket)

    return app


# uvicorn entrypoint for the standalone API process
app = None


def get_app() -> FastAPI:
    global app
    if app is None:
        app = create_app()
    return app
