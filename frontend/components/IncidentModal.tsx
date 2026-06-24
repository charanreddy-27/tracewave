"use client";

import { useEffect, useRef, useState } from "react";
import type { AnomalyMsg, MetricMsg } from "@/lib/types";
import { clockTime, compact, dimLabel, pct, severityLabel } from "@/lib/format";
import { PulseChart } from "./PulseChart";

interface Incident {
  anomaly: AnomalyMsg;
  series: MetricMsg[];
}

const SEV: Record<string, string> = { info: "#5b9dff", warn: "#f3b24c", critical: "#f4596b" };

export function IncidentModal({
  anomaly,
  onClose,
}: {
  anomaly: AnomalyMsg | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!anomaly) return;
    setData(null);
    setLoading(true);
    // Live incident history comes from the backend; in demo mode there's no such
    // endpoint, so we fall back to the evidence already on the anomaly.
    const isDemo = anomaly.id.startsWith("demo-");
    const ctrl = new AbortController();
    if (isDemo) {
      setData({ anomaly, series: [] });
      setLoading(false);
    } else {
      fetch(`/api/incident/${anomaly.id}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: Incident) => setData(d))
        .catch(() => setData({ anomaly, series: [] }))
        .finally(() => setLoading(false));
    }
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      ctrl.abort();
      window.removeEventListener("keydown", onKey);
    };
  }, [anomaly, onClose]);

  if (!anomaly) return null;
  const sev = SEV[anomaly.severity] ?? SEV.info;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-line-strong bg-panel shadow-glow"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-title"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em]"
              style={{ color: sev, background: `${sev}1f` }}
            >
              {severityLabel(anomaly.severity)}
            </span>
            <h3 id="incident-title" className="text-sm font-medium text-ink">
              Incident replay
            </h3>
            <span className="tnum text-2xs text-faint">{clockTime(anomaly.ts)}</span>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close incident replay"
            className="rounded-md px-2 py-1 text-muted hover:bg-panel-2 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-line bg-base/40 p-2">
            {loading ? (
              <div className="skeleton h-[200px] w-full rounded" />
            ) : (
              <PulseChart
                metrics={data?.series ?? []}
                anomalies={[anomaly]}
                windowSeconds={130}
                height={200}
              />
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="observed" value={compact(anomaly.value)} color={sev} />
            <Stat label="expected" value={compact(anomaly.expected)} />
            <Stat label="confidence" value={pct(anomaly.score)} color={sev} />
          </div>

          {anomaly.why.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-2xs uppercase tracking-[0.12em] text-faint">
                Contributing dimensions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {anomaly.why.slice(0, 8).map((c, i) => (
                  <span
                    key={i}
                    className="tnum rounded border border-line bg-panel-2/60 px-2 py-1 text-[11px] text-muted"
                  >
                    <span className="text-faint">{dimLabel(c.dim)}:</span> {c.value}{" "}
                    <span style={{ color: sev }}>+{compact(c.excess)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {!loading && (data?.series.length ?? 0) === 0 && (
            <p className="mt-3 text-2xs text-faint">
              Live history for this window has rolled out of the buffer (or persistence is
              off). The anomaly evidence above is preserved.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-line bg-base/40 p-3">
      <div className="text-[10px] text-faint">{label}</div>
      <div className="tnum text-lg font-semibold" style={{ color: color ?? "#e7ebf2" }}>
        {value}
      </div>
    </div>
  );
}
