"""Feature helpers: per-dimension baselines and the anomaly "why" breakdown.

When the overall rate spikes we want to explain *which* slices drove it — which
wiki/language, which namespace, which user-type. :class:`DimBaseline` keeps a
decaying baseline count for every dimension value; :meth:`DimBaseline.breakdown`
diffs the current window against those baselines and ranks the biggest movers.
"""

from __future__ import annotations

from typing import Dict, List

from tracewave.models import Contribution, MetricSnapshot


class DimBaseline:
    """EWMA baseline of per-dimension-value counts, with pruning."""

    def __init__(self, alpha: float = 0.05, prune_below: float = 0.05) -> None:
        self.alpha = alpha
        self.prune_below = prune_below
        self._base: Dict[str, Dict[str, float]] = {}

    def update(self, dim_counts: Dict[str, Dict[str, int]]) -> None:
        a = self.alpha
        for dim, counts in dim_counts.items():
            base = self._base.setdefault(dim, {})
            seen = set(counts)
            # Decay every known value toward its observed count (0 if absent).
            for value in set(base.keys()) | seen:
                observed = float(counts.get(value, 0))
                prev = base.get(value, 0.0)
                base[value] = (1 - a) * prev + a * observed
                if base[value] < self.prune_below and value not in seen:
                    del base[value]

    def baseline_for(self, dim: str, value: str) -> float:
        return self._base.get(dim, {}).get(value, 0.0)

    def breakdown(self, snap: MetricSnapshot, top_n: int = 6,
                  min_excess: float = 1.0) -> List[Contribution]:
        """Rank the dimension values whose count most exceeds their baseline."""
        contribs: List[Contribution] = []
        for dim, counts in snap.dim_counts.items():
            for value, observed in counts.items():
                base = self.baseline_for(dim, value)
                excess = observed - base
                if excess >= min_excess:
                    contribs.append(Contribution(
                        dim=dim, value=value, observed=int(observed),
                        baseline=round(base, 2), excess=round(excess, 2), share=0.0,
                    ))
        if not contribs:
            return []
        # Share is computed *within* each dimension, so a row reads naturally:
        # "en.wikipedia.org = 98% of the excess among wikis" rather than being
        # diluted across unrelated dimensions (lang, namespace, user_type, ...).
        dim_totals: Dict[str, float] = {}
        for c in contribs:
            dim_totals[c.dim] = dim_totals.get(c.dim, 0.0) + c.excess
        for c in contribs:
            c.share = round(c.excess / (dim_totals[c.dim] or 1.0), 4)
        contribs.sort(key=lambda c: c.excess, reverse=True)
        return contribs[:top_n]
