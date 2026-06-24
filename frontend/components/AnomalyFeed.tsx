import type { AnomalyMsg } from "@/lib/types";
import { Panel } from "./ui";
import { AnomalyCard } from "./AnomalyCard";

export function AnomalyFeed({
  anomalies,
  onReplay,
}: {
  anomalies: AnomalyMsg[];
  onReplay: (a: AnomalyMsg) => void;
}) {
  return (
    <Panel
      title="Anomaly feed"
      right={<span className="tnum text-2xs text-faint">{anomalies.length} shown</span>}
      bodyClass="px-3"
      className="flex h-full flex-col"
    >
      {anomalies.length === 0 ? (
        <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
          <div className="mb-2 h-8 w-8 rounded-full border border-line bg-panel-2" />
          <p className="text-sm text-muted">No anomalies yet</p>
          <p className="mt-1 max-w-[220px] text-xs text-faint">
            The firehose looks calm. Cards slide in here the moment a detector catches a spike.
          </p>
        </div>
      ) : (
        <div className="scroll-slim flex max-h-[640px] flex-col gap-2.5 overflow-y-auto pr-1">
          {anomalies.map((a) => (
            <AnomalyCard key={a.id} a={a} onReplay={onReplay} />
          ))}
        </div>
      )}
    </Panel>
  );
}
