import type { MetricMsg } from "@/lib/types";
import { Panel } from "./ui";
import { Sparkline } from "./Sparkline";

const META: Record<string, { label: string; blurb: string; color: string }> = {
  zscore: { label: "Z-Score", blurb: "rolling σ on rate", color: "#34e3c8" },
  ewma: { label: "EWMA", blurb: "control chart", color: "#5b9dff" },
  hst: { label: "Half-Space Trees", blurb: "online · multivariate", color: "#9b8cff" },
};
const ORDER = ["zscore", "ewma", "hst"];

export function DetectorComparison({ metrics }: { metrics: MetricMsg[] }) {
  const last = metrics[metrics.length - 1];
  const detectors = last?.detectors ?? [];
  const byName = Object.fromEntries(detectors.map((d) => [d.name, d]));

  // agreement over the recent window: how many detectors flagged each tick
  const recent = metrics.slice(-48);
  const agree = recent.map((m) => m.detectors.filter((d) => d.flag).length);
  const liveAgree = last ? last.detectors.filter((d) => d.flag).length : 0;
  const available = detectors.filter((d) => d.available).length;

  return (
    <Panel
      title="Detectors"
      right={
        <span className="tnum text-2xs text-muted">
          agreement{" "}
          <span className={liveAgree >= 2 ? "text-crit" : liveAgree === 1 ? "text-warn" : "text-faint"}>
            {liveAgree}
          </span>
          /{available || 0}
        </span>
      }
    >
      <div className="space-y-3">
        {ORDER.map((name) => {
          const d = byName[name];
          const meta = META[name];
          const avail = d?.available ?? false;
          const score = d?.score ?? 0;
          const flag = d?.flag ?? false;
          const series = metrics.slice(-60).map((m) => {
            const dd = m.detectors.find((x) => x.name === name);
            return dd?.score ?? 0;
          });
          return (
            <div key={name} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-ink">{meta.label}</span>
                  {flag && (
                    <span className="rounded bg-crit/15 px-1 text-[9px] font-semibold tracking-wide text-crit">
                      FIRED
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-faint">
                  {avail ? meta.blurb : "unavailable"}
                </div>
              </div>

              <div className="relative h-7 flex-1 overflow-hidden rounded-md border border-line bg-base/60">
                {avail ? (
                  <>
                    <div className="absolute inset-y-0 left-0 opacity-50">
                      <div className="h-7 w-[200px] max-w-full">
                        <Sparkline data={series} color={meta.color} height={28} fill={false} />
                      </div>
                    </div>
                    <div
                      className="absolute inset-y-0 left-0 transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, score * 100)}%`,
                        background: `linear-gradient(90deg, ${meta.color}22, ${meta.color}${flag ? "55" : "33"})`,
                        borderRight: `2px solid ${meta.color}`,
                      }}
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center px-2 text-[10px] text-faint">
                    install <span className="px-1 font-mono text-muted">river</span> to enable
                  </div>
                )}
              </div>

              <span className="tnum w-10 shrink-0 text-right text-xs text-muted">
                {avail ? score.toFixed(2) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-1.5 text-2xs uppercase tracking-[0.14em] text-faint">
          Agreement · last {recent.length}s
        </div>
        <div className="flex h-6 items-end gap-[2px]">
          {agree.map((a, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${(a / 3) * 100 || 6}%`,
                minHeight: 2,
                background: a >= 2 ? "#f4596b" : a === 1 ? "#f3b24c" : "#222a36",
              }}
              title={`${a} detector(s) flagged`}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}
