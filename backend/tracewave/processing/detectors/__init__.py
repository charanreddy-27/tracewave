"""Online anomaly detectors and their ensemble.

Three independent opinions on each metric tick:

* :class:`~tracewave.processing.detectors.zscore.RollingZScore` — rolling z-score
  on the primary scalar metric (classic, interpretable baseline).
* :class:`~tracewave.processing.detectors.ewma.EwmaDetector` — EWMA control chart;
  reacts faster to regime shifts, smoother memory than a fixed window.
* :class:`~tracewave.processing.detectors.hst.HalfSpaceTreesDetector` — river's
  online Half-Space Trees over the *full* feature vector (holistic, multivariate).

The :class:`~tracewave.processing.detectors.ensemble.Ensemble` blends them into a
single confidence score and an agreement count, which is what the dashboard's
detector-comparison view renders.
"""

from tracewave.processing.detectors.base import Detector
from tracewave.processing.detectors.ewma import EwmaDetector
from tracewave.processing.detectors.ensemble import Ensemble, EnsembleConfig
from tracewave.processing.detectors.hst import HalfSpaceTreesDetector
from tracewave.processing.detectors.zscore import RollingZScore

__all__ = [
    "Detector",
    "RollingZScore",
    "EwmaDetector",
    "HalfSpaceTreesDetector",
    "Ensemble",
    "EnsembleConfig",
]
