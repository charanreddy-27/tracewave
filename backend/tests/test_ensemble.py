"""Ensemble confidence, agreement, severity and cooldown."""

from tracewave.models import DetectorResult
from tracewave.processing.detectors.ensemble import Ensemble, EnsembleConfig


def res(name, flag, score, expected=100.0, value=400.0, unavailable=False):
    return DetectorResult(name=name, flag=flag, score=score, value=value,
                          expected=expected,
                          detail={"unavailable": True} if unavailable else {})


def test_no_anomaly_when_nothing_fires():
    ens = Ensemble()
    out = ens.evaluate("rate", 400.0,
                       [res("zscore", False, 0.1), res("ewma", False, 0.2)],
                       ts=1.0, window_start=0.0, window_end=1.0)
    assert out is None


def test_single_strong_detector_surfaces():
    ens = Ensemble()
    out = ens.evaluate("rate", 400.0, [res("zscore", True, 0.95)],
                       ts=1.0, window_start=0.0, window_end=1.0)
    assert out is not None
    assert out.agreement == 1
    assert out.score >= 0.9


def test_agreement_increases_confidence_and_severity():
    ens = Ensemble()
    out = ens.evaluate(
        "rate", 400.0,
        [res("zscore", True, 0.8), res("ewma", True, 0.8), res("hst", True, 0.8)],
        ts=1.0, window_start=0.0, window_end=1.0,
    )
    assert out.agreement == 3
    assert out.score >= 0.8
    assert out.severity == "critical"  # full agreement at high score


def test_one_of_three_is_suppressed():
    ens = Ensemble()
    out = ens.evaluate(
        "rate", 400.0,
        [res("zscore", True, 0.8), res("ewma", False, 0.1), res("hst", False, 0.1)],
        ts=1.0, window_start=0.0, window_end=1.0,
    )
    # 0.8 / 3 available = 0.27 confidence, below min_confidence -> suppressed
    assert out is None


def test_unavailable_detectors_do_not_count_against_confidence():
    ens = Ensemble()
    out = ens.evaluate(
        "rate", 400.0,
        [res("zscore", True, 0.8), res("ewma", True, 0.8),
         res("hst", False, 0.0, unavailable=True)],
        ts=1.0, window_start=0.0, window_end=1.0,
    )
    # only 2 available, both fired -> 1.6/2 = 0.8
    assert out is not None
    assert out.score >= 0.8
    assert out.agreement == 2


def test_cooldown_suppresses_repeat():
    ens = Ensemble(EnsembleConfig(cooldown_seconds=5.0))
    first = ens.evaluate("rate", 400.0, [res("zscore", True, 0.95)],
                         ts=10.0, window_start=9.0, window_end=10.0)
    assert first is not None
    # within cooldown window -> suppressed
    second = ens.evaluate("rate", 410.0, [res("zscore", True, 0.95)],
                          ts=12.0, window_start=11.0, window_end=12.0)
    assert second is None
    # after cooldown -> fires again
    third = ens.evaluate("rate", 420.0, [res("zscore", True, 0.95)],
                         ts=16.0, window_start=15.0, window_end=16.0)
    assert third is not None
