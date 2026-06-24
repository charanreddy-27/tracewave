"""Prometheus self-metrics — observability *of* the observability tool.

The pipeline measures its own health (throughput, lag, drops, detector fires) so
a Grafana panel can show whether Tracewave itself is keeping up with the
firehose. ``prometheus_client`` is optional; if absent these become no-ops.
"""

from __future__ import annotations

try:
    from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST

    EVENTS_INGESTED = Counter("tw_events_ingested_total", "Events pulled from the firehose")
    EVENTS_PROCESSED = Counter("tw_events_processed_total", "Events folded into windows")
    EVENTS_DROPPED = Counter("tw_events_dropped_total", "Events shed under backpressure")
    SNAPSHOTS = Counter("tw_window_snapshots_total", "Completed window snapshots")
    ANOMALIES = Counter("tw_anomalies_total", "Anomalies raised", ["severity"])
    DETECTOR_FIRED = Counter("tw_detector_fired_total", "Detector flag events", ["detector"])
    RATE_GAUGE = Gauge("tw_events_per_sec", "Current events/sec (latest window)")
    LAG_GAUGE = Gauge("tw_processing_lag_seconds", "Wall-clock lag behind event arrival")
    PROCESS_TIME = Histogram("tw_window_process_seconds", "Time to process one window")

    AVAILABLE = True

    def render() -> tuple[bytes, str]:
        return generate_latest(), CONTENT_TYPE_LATEST

    def start_server(port: int) -> bool:
        """Expose this process's metrics on its own HTTP endpoint.

        Needed in the distributed Compose stack where the processor and ingestor
        run as separate processes from the API (each has its own registry).
        """
        if not port:
            return False
        from prometheus_client import start_http_server

        start_http_server(port)
        return True

except Exception:  # pragma: no cover
    AVAILABLE = False

    class _Noop:
        def labels(self, *a, **k):
            return self

        def inc(self, *a, **k):
            return None

        def set(self, *a, **k):
            return None

        def observe(self, *a, **k):
            return None

    EVENTS_INGESTED = EVENTS_PROCESSED = EVENTS_DROPPED = _Noop()
    SNAPSHOTS = ANOMALIES = DETECTOR_FIRED = _Noop()
    RATE_GAUGE = LAG_GAUGE = PROCESS_TIME = _Noop()

    def render() -> tuple[bytes, str]:
        return b"# prometheus_client not installed\n", "text/plain"

    def start_server(port: int) -> bool:
        return False
