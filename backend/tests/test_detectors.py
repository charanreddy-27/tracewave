"""Detector thresholds + the synthetic-spike test that proves detection works."""

import math

from tracewave.processing.detectors import EwmaDetector, RollingZScore
from tracewave.processing.detectors.hst import HalfSpaceTreesDetector


def test_zscore_warmup_then_no_false_positive_on_flat_noise():
    det = RollingZScore(window=60, threshold=3.0, min_samples=12)
    # steady noise around 100 should never flag
    fired = []
    vals = [100, 101, 99, 100, 102, 98, 100, 101, 99, 100, 100, 101,
            99, 100, 101, 100, 99, 100, 101, 99]
    for v in vals:
        r = det.update(float(v))
        fired.append(r.flag)
    assert not any(fired)


def test_zscore_flags_synthetic_spike():
    det = RollingZScore(window=60, threshold=3.0, min_samples=12)
    # build a stable baseline around 100 with small variance
    for v in [100, 101, 99, 100, 102, 98, 100, 101, 99, 100, 100, 101, 99, 100]:
        r = det.update(float(v))
        assert not r.flag
    # inject a clear spike
    spike = det.update(400.0)
    assert spike.flag
    assert spike.score > 0.5
    assert spike.detail["z"] > 3.0
    assert spike.expected < 150  # expected stayed near the baseline


def test_zscore_direction_up_ignores_drops():
    det = RollingZScore(window=30, threshold=3.0, min_samples=12, direction="up")
    for _ in range(20):
        det.update(100.0)
    drop = det.update(0.0)      # large *downward* departure
    assert not drop.flag        # direction="up" ignores it
    spike = det.update(100.0)   # re-stabilise
    big = det.update(500.0)
    assert big.flag


def test_ewma_flags_spike_and_tracks_drift():
    det = EwmaDetector(alpha=0.1, threshold=3.0, warmup=12)
    for v in [50, 51, 49, 50, 52, 48, 50, 51, 49, 50, 50, 51, 49, 50]:
        r = det.update(float(v))
    assert not r.flag
    spike = det.update(300.0)
    assert spike.flag
    assert spike.score > 0.5


def test_ewma_adapts_to_slow_regime_shift():
    det = EwmaDetector(alpha=0.2, threshold=3.0, warmup=10)
    # slowly ramp the level; EWMA should follow without flagging every step
    flags = []
    v = 100.0
    for _ in range(60):
        v += 0.5  # gentle drift
        flags.append(det.update(v).flag)
    # a slow drift should not be treated as a storm of anomalies
    assert sum(flags) <= 3


def test_hst_is_optional_and_degrades_gracefully():
    det = HalfSpaceTreesDetector()
    r = det.update(1.0, features={"rate": 1.0})
    if not det.available:
        # river not installed: never flags, marks itself unavailable
        assert r.flag is False
        assert r.detail.get("unavailable") is True
    else:
        # river installed: should produce a score in [0,1]
        assert 0.0 <= r.score <= 1.0
