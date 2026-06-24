"""Runtime configuration (env-driven, with sensible local defaults).

Every setting can be overridden via environment variables (``TW_`` prefix) or a
``.env`` file, so the same code runs in single-process dev mode and in the
Docker Compose stack without edits.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TW_", env_file=".env", extra="ignore")

    # --- firehose -------------------------------------------------------- #
    source: str = "wikimedia"
    sse_url: str = "https://stream.wikimedia.org/v2/stream/recentchange"
    # Wikimedia's User-Agent policy requires a descriptive UA with contact info,
    # otherwise the CDN returns 403. Override TW_USER_AGENT with your own contact.
    user_agent: str = (
        "Tracewave/0.1 (real-time anomaly-detection demo; "
        "https://github.com/tracewave/tracewave)"
    )
    # Cap events/sec pulled from the firehose to keep the demo box sane (0 = no cap).
    max_events_per_sec: int = 0

    # --- windowing / detectors ------------------------------------------ #
    tick_seconds: float = 1.0
    primary_metric: str = "rate"
    zscore_window: int = 60
    zscore_threshold: float = 3.2
    ewma_alpha: float = 0.08
    ewma_threshold: float = 3.2
    hst_threshold: float = 0.85
    detector_direction: str = "up"   # firehose spikes are the interesting case

    # --- transports ------------------------------------------------------ #
    # When redis_url is empty the single-process in-memory bus is used.
    redis_url: str = ""
    events_stream: str = "tracewave:events"
    metrics_channel: str = "tracewave:metrics"
    anomalies_channel: str = "tracewave:anomalies"
    stream_maxlen: int = 50_000      # approx cap -> backpressure / bounded memory
    consumer_group: str = "proc"

    # --- storage --------------------------------------------------------- #
    # When pg_dsn is empty, persistence is skipped (history served from memory).
    pg_dsn: str = ""
    history_seconds: int = 24 * 3600

    # --- api ------------------------------------------------------------- #
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    # Per-process Prometheus endpoint for the ingestor/processor services
    # (0 = disabled; the all-in-one dev runner exposes metrics via the API).
    metrics_port: int = 0
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    history_buffer: int = 900        # ticks kept in memory for instant client backfill
    anomaly_buffer: int = 200

    # --- replay / record ------------------------------------------------- #
    replay_file: str = ""
    replay_speed: float = 1.0        # 1.0 = realtime; >1 fast-forward
    record_file: str = ""            # if set, tee the live stream to this JSONL

    @property
    def use_redis(self) -> bool:
        return bool(self.redis_url)

    @property
    def use_postgres(self) -> bool:
        return bool(self.pg_dsn)


@lru_cache
def get_settings() -> Settings:
    return Settings()
