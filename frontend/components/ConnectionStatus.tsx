import type { ConnState } from "@/lib/types";
import { Dot } from "./ui";

const MAP: Record<ConnState, { label: string; color: string; pulse: boolean }> = {
  live: { label: "LIVE", color: "#34e3c8", pulse: true },
  connecting: { label: "CONNECTING", color: "#8b94a4", pulse: true },
  stale: { label: "STALE", color: "#f3b24c", pulse: false },
  reconnecting: { label: "RECONNECTING", color: "#f3b24c", pulse: true },
  offline: { label: "OFFLINE", color: "#f4596b", pulse: false },
};

export function ConnectionStatus({ status }: { status: ConnState }) {
  const s = MAP[status];
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-panel-2/70 px-3 py-1.5">
      <Dot color={s.color} pulse={s.pulse} />
      <span
        className="tnum text-2xs font-semibold tracking-[0.14em]"
        style={{ color: s.color }}
      >
        {s.label}
      </span>
    </div>
  );
}
