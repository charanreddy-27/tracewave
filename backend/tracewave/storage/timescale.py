"""TimescaleDB store (asyncpg) + a NullStore no-op for single-process dev mode."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from tracewave import serde

log = logging.getLogger("tracewave.storage")

_MIGRATIONS = os.path.join(os.path.dirname(__file__), "migrations.sql")


class NullStore:
    """Used when no DSN is configured; history is served from memory instead."""

    enabled = False

    async def connect(self) -> None: ...
    async def init_schema(self) -> None: ...
    async def insert_metric(self, msg: Dict[str, Any]) -> None: ...
    async def insert_anomaly(self, msg: Dict[str, Any]) -> None: ...
    async def recent_metrics(self, seconds: int) -> List[Dict[str, Any]]:
        return []
    async def recent_anomalies(self, limit: int = 100) -> List[Dict[str, Any]]:
        return []
    async def incident(self, anomaly_id: str, pad: int = 60) -> Optional[Dict[str, Any]]:
        return None
    async def close(self) -> None: ...


class TimescaleStore:
    enabled = True

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self._pool = None

    async def _init_conn(self, conn) -> None:
        # decode jsonb to / from python objects transparently
        await conn.set_type_codec(
            "jsonb", encoder=serde.dumps_str, decoder=serde.loads,
            schema="pg_catalog",
        )

    async def connect(self) -> None:
        import asyncpg

        self._pool = await asyncpg.create_pool(
            self.dsn, min_size=1, max_size=8, init=self._init_conn
        )

    async def init_schema(self) -> None:
        with open(_MIGRATIONS, "r", encoding="utf-8") as fh:
            sql = fh.read()
        # Execute statements one-by-one so timescale-only statements failing on a
        # plain Postgres instance don't abort the base table creation.
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        async with self._pool.acquire() as conn:
            for stmt in statements:
                try:
                    await conn.execute(stmt)
                except Exception as exc:  # noqa: BLE001
                    log.warning("schema stmt skipped (%s): %s", exc, stmt[:60])

    async def insert_metric(self, m: Dict[str, Any]) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO metrics
                   (time, source, rate, count, distinct_subjects, distinct_actors,
                    bot_ratio, bytes_per_sec, new_rate, detectors, top)
                   VALUES (to_timestamp($1),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)""",
                m["t"], m.get("source", "wikimedia"), m["rate"], m["count"],
                m["distinct_subjects"], m["distinct_actors"], m["bot_ratio"],
                m["bytes_per_sec"], m["new_rate"], m.get("detectors", []),
                m.get("top", {}),
            )

    async def insert_anomaly(self, a: Dict[str, Any]) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO anomalies
                   (id, time, metric, value, expected, severity, score, agreement,
                    detectors, why, window_start, window_end)
                   VALUES ($1, to_timestamp($2), $3,$4,$5,$6,$7,$8,$9,$10,
                           to_timestamp($11), to_timestamp($12))
                   ON CONFLICT (id, time) DO NOTHING""",
                a["id"], a["ts"], a["metric"], a["value"], a["expected"],
                a["severity"], a["score"], a["agreement"], a.get("detectors", []),
                a.get("why", []), a.get("window_start"), a.get("window_end"),
            )

    async def recent_metrics(self, seconds: int) -> List[Dict[str, Any]]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT extract(epoch from time) AS t, rate, count,
                          distinct_subjects, distinct_actors, bot_ratio,
                          bytes_per_sec, new_rate, detectors, top
                   FROM metrics
                   WHERE time > now() - ($1 || ' seconds')::interval
                   ORDER BY time ASC""",
                str(seconds),
            )
            return [self._metric_row(r) for r in rows]

    async def recent_anomalies(self, limit: int = 100) -> List[Dict[str, Any]]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, extract(epoch from time) AS ts, metric, value, expected,
                          severity, score, agreement, detectors, why,
                          extract(epoch from window_start) AS window_start,
                          extract(epoch from window_end) AS window_end
                   FROM anomalies ORDER BY time DESC LIMIT $1""",
                limit,
            )
            return [self._anomaly_row(r) for r in rows]

    async def incident(self, anomaly_id: str, pad: int = 60) -> Optional[Dict[str, Any]]:
        async with self._pool.acquire() as conn:
            arow = await conn.fetchrow(
                """SELECT id, extract(epoch from time) AS ts, metric, value, expected,
                          severity, score, agreement, detectors, why,
                          extract(epoch from window_start) AS window_start,
                          extract(epoch from window_end) AS window_end
                   FROM anomalies WHERE id = $1""",
                anomaly_id,
            )
            if arow is None:
                return None
            anomaly = self._anomaly_row(arow)
            rows = await conn.fetch(
                """SELECT extract(epoch from time) AS t, rate, count,
                          distinct_subjects, distinct_actors, bot_ratio,
                          bytes_per_sec, new_rate, detectors, top
                   FROM metrics
                   WHERE time BETWEEN to_timestamp($1) AND to_timestamp($2)
                   ORDER BY time ASC""",
                anomaly["ts"] - pad, anomaly["ts"] + pad,
            )
            return {"anomaly": anomaly, "series": [self._metric_row(r) for r in rows]}

    @staticmethod
    def _metric_row(r) -> Dict[str, Any]:
        return {
            "type": "metric", "t": r["t"], "rate": r["rate"], "count": r["count"],
            "distinct_subjects": r["distinct_subjects"],
            "distinct_actors": r["distinct_actors"], "bot_ratio": r["bot_ratio"],
            "bytes_per_sec": r["bytes_per_sec"], "new_rate": r["new_rate"],
            "detectors": r["detectors"], "top": r["top"],
        }

    @staticmethod
    def _anomaly_row(r) -> Dict[str, Any]:
        return {
            "type": "anomaly", "id": r["id"], "ts": r["ts"], "metric": r["metric"],
            "value": r["value"], "expected": r["expected"], "severity": r["severity"],
            "score": r["score"], "agreement": r["agreement"],
            "detectors": r["detectors"], "why": r["why"],
            "window_start": r["window_start"], "window_end": r["window_end"],
        }

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()


def make_store(settings):
    return TimescaleStore(settings.pg_dsn) if settings.use_postgres else NullStore()
