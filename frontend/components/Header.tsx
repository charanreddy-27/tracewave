import Link from "next/link";
import type { ConnState, MetricMsg } from "@/lib/types";
import type { StreamMode } from "@/lib/useLiveStream";
import { compact } from "@/lib/format";
import { links } from "@/lib/site";
import { BrandMark } from "./Brand";
import { ConnectionStatus } from "./ConnectionStatus";

const NAV = [
  { href: links.about, label: "About" },
  { href: links.project, label: "The project" },
];

export function Header({
  status,
  mode,
  source,
  latest,
  totalAnomalies,
}: {
  status: ConnState;
  mode: StreamMode;
  source: string;
  latest: MetricMsg | null;
  totalAnomalies: number;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold leading-tight tracking-tight text-ink">
              Tracewave
              {mode === "demo" && (
                <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-accent">
                  DEMO
                </span>
              )}
            </h1>
            <p className="text-2xs text-faint">
              live anomaly detection · <span className="text-muted">{source}</span> firehose
            </p>
          </div>
        </div>
        <nav className="hidden items-center gap-1 border-l border-line pl-3 text-2xs md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 uppercase tracking-[0.12em] text-faint transition-colors hover:bg-panel-2/60 hover:text-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-5">
        <div className="text-right">
          <div className="text-2xs uppercase tracking-[0.14em] text-faint">events / sec</div>
          <div className="tnum text-2xl font-semibold leading-none text-accent">
            {latest ? compact(latest.rate) : "—"}
          </div>
        </div>
        <div className="hidden h-9 w-px bg-line sm:block" />
        <div className="hidden text-right sm:block">
          <div className="text-2xs uppercase tracking-[0.14em] text-faint">anomalies</div>
          <div className="tnum text-2xl font-semibold leading-none text-ink">
            {totalAnomalies}
          </div>
        </div>
        <ConnectionStatus status={status} />
      </div>
    </header>
  );
}
