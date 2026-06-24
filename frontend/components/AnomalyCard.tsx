import type { AnomalyMsg } from "@/lib/types";
import { ago, clockTime, compact, dimLabel, pct, severityLabel } from "@/lib/format";

const SEV: Record<string, { color: string; bg: string }> = {
  info: { color: "#5b9dff", bg: "rgba(91,157,255,0.09)" },
  warn: { color: "#f3b24c", bg: "rgba(243,178,76,0.09)" },
  critical: { color: "#f4596b", bg: "rgba(244,89,107,0.10)" },
};

export function AnomalyCard({
  a,
  onReplay,
}: {
  a: AnomalyMsg;
  onReplay: (a: AnomalyMsg) => void;
}) {
  const sev = SEV[a.severity] ?? SEV.info;
  const fired = a.detectors.filter((d) => d.flag);
  const factor = a.expected > 0 ? a.value / a.expected : 0;

  return (
    <article
      className="animate-slide-settle overflow-hidden rounded-lg border border-line bg-panel-2/60"
      style={{ borderLeft: `2px solid ${sev.color}`, background: sev.bg }}
    >
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="tnum rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em]"
              style={{ color: sev.color, background: `${sev.color}1f` }}
            >
              {severityLabel(a.severity)}
            </span>
            <span className="text-xs font-medium text-ink">{a.metric} spike</span>
          </div>
          <span className="tnum text-2xs text-faint" title={clockTime(a.ts)}>
            {ago(a.ts)}
          </span>
        </div>

        <div className="mt-2 flex items-end gap-4">
          <div>
            <div className="text-[10px] text-faint">observed</div>
            <div className="tnum text-xl font-semibold text-ink">{compact(a.value)}</div>
          </div>
          <div className="pb-0.5 text-faint">vs</div>
          <div>
            <div className="text-[10px] text-faint">expected</div>
            <div className="tnum text-base text-muted">{compact(a.expected)}</div>
          </div>
          {factor > 1.2 && (
            <div className="pb-0.5">
              <span
                className="tnum text-sm font-semibold"
                style={{ color: sev.color }}
              >
                {factor >= 10 ? compact(factor) : factor.toFixed(1)}×
              </span>
            </div>
          )}
          <div className="ml-auto text-right">
            <div className="text-[10px] text-faint">confidence</div>
            <div className="tnum text-base font-semibold" style={{ color: sev.color }}>
              {pct(a.score)}
            </div>
          </div>
        </div>

        {/* which detectors corroborated */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-faint">
            {a.agreement}/{a.detectors.filter((d) => !d.detail?.unavailable).length} agree
          </span>
          {fired.map((d) => (
            <span
              key={d.name}
              className="tnum rounded border border-line bg-base/50 px-1.5 py-0.5 text-[10px] text-muted"
            >
              {d.name}
              {typeof d.detail?.z === "number" && (
                <span className="text-faint"> z{(d.detail.z as number).toFixed(1)}</span>
              )}
            </span>
          ))}
        </div>

        {/* the "why": top contributing dimensions */}
        {a.why.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-faint">why</div>
            {a.why.slice(0, 4).map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-[11px] text-muted" title={c.value}>
                  <span className="text-faint">{dimLabel(c.dim)}:</span> {c.value}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base/70">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, c.share * 100)}%`, background: sev.color }}
                  />
                </div>
                <span className="tnum w-12 shrink-0 text-right text-[10px] text-faint">
                  +{compact(c.excess)}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onReplay(a)}
          className="mt-3 w-full rounded-md border border-line bg-base/40 py-1.5 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          ▸ Replay this window
        </button>
      </div>
    </article>
  );
}
