"""Wire format shared by the live hub, the history buffer and the REST API.

Keeping one place that turns domain objects into the compact JSON the dashboard
consumes means the live WebSocket feed and the historical backfill are always
byte-for-byte consistent.
"""

from __future__ import annotations

from typing import Dict, List, Sequence

from tracewave.models import Anomaly, DetectorResult, MetricSnapshot


def metric_message(snap: MetricSnapshot, results: Sequence[DetectorResult]) -> Dict:
    """Compact per-tick metric message (one per completed window)."""
    detectors = [
        {
            "name": r.name,
            "score": round(r.score, 4),
            "flag": r.flag,
            "z": r.detail.get("z"),
            "available": not r.detail.get("unavailable", False),
        }
        for r in results
    ]
    top = {
        dim: list(vals.items())[:6]
        for dim, vals in snap.dim_counts.items()
        if dim in ("domain", "lang")
    }
    return {
        "type": "metric",
        "t": round(snap.window_end, 3),
        "ws": round(snap.window_start, 3),
        "rate": round(snap.rate, 3),
        "count": snap.count,
        "distinct_subjects": snap.distinct_subjects,
        "distinct_actors": snap.distinct_actors,
        "bot_ratio": round(snap.metrics.get("bot_ratio", 0.0), 4),
        "bytes_per_sec": round(snap.metrics.get("bytes_per_sec", 0.0), 1),
        "new_rate": round(snap.metrics.get("new_rate", 0.0), 3),
        "detectors": detectors,
        "top": top,
    }


def anomaly_message(anom: Anomaly) -> Dict:
    d = anom.as_dict()
    d["type"] = "anomaly"
    return d
