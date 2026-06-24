"use client";

import { useState } from "react";
import { useLiveStream } from "@/lib/useLiveStream";
import type { AnomalyMsg } from "@/lib/types";
import { Header } from "@/components/Header";
import { PulseChart } from "@/components/PulseChart";
import { MetricTiles } from "@/components/MetricTiles";
import { DetectorComparison } from "@/components/DetectorComparison";
import { AnomalyFeed } from "@/components/AnomalyFeed";
import { IncidentModal } from "@/components/IncidentModal";
import { DemoBanner } from "@/components/DemoBanner";
import { Panel } from "@/components/ui";
import { compact } from "@/lib/format";
import { author } from "@/lib/site";

export default function Page() {
  const { status, mode, metrics, anomalies, latest, source, totalAnomalies } = useLiveStream();
  const [incident, setIncident] = useState<AnomalyMsg | null>(null);
  const hasData = metrics.length > 0;

  const peak = metrics.reduce((m, x) => Math.max(m, x.rate), 0);
  const totalEvents = metrics.reduce((s, x) => s + x.count, 0);

  return (
    <main className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6">
      <Header
        status={status}
        mode={mode}
        source={source}
        latest={latest}
        totalAnomalies={totalAnomalies}
      />

      {mode === "demo" && <DemoBanner />}

      {/* hero pulse chart */}
      <div className="mt-4">
        <Panel
          title="Firehose pulse · events / sec"
          right={
            <div className="flex items-center gap-4 text-2xs text-faint">
              <span className="tnum">
                peak <span className="text-muted">{compact(peak)}</span>
              </span>
              <span className="tnum">
                window <span className="text-muted">{compact(totalEvents, 0)}</span> ev
              </span>
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="h-px w-4 bg-accent" /> rate
                <span className="ml-2 h-2 w-2 rotate-45 bg-crit" /> anomaly
              </span>
            </div>
          }
        >
          {hasData ? (
            <PulseChart metrics={metrics} anomalies={anomalies} windowSeconds={120} height={248} />
          ) : (
            <WaitingHero status={status} />
          )}
        </Panel>
      </div>

      {/* metric tiles */}
      <div className="mt-3">
        {hasData ? (
          <MetricTiles metrics={metrics} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[116px] rounded-xl border border-line" />
            ))}
          </div>
        )}
      </div>

      {/* detectors + anomaly feed */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {hasData ? (
            <DetectorComparison metrics={metrics} />
          ) : (
            <div className="skeleton h-[300px] rounded-xl border border-line" />
          )}
        </div>
        <div className="lg:col-span-2">
          <AnomalyFeed anomalies={anomalies} onReplay={setIncident} />
        </div>
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-2xs text-faint">
        <span>
          Tracewave — streaming windows · z-score / EWMA / Half-Space Trees · WebSocket push
        </span>
        <div className="flex items-center gap-4">
          <a href="/about" className="uppercase tracking-[0.12em] transition-colors hover:text-muted">
            About
          </a>
          <a
            href="/about-project"
            className="uppercase tracking-[0.12em] transition-colors hover:text-muted"
          >
            The project
          </a>
          <a
            href={author.portfolio}
            target="_blank"
            rel="noreferrer"
            className="uppercase tracking-[0.12em] transition-colors hover:text-accent"
          >
            charanreddy.dev ↗
          </a>
          <span className="tnum hidden sm:inline">
            {metrics.length} windows · {source}
          </span>
        </div>
      </footer>

      <IncidentModal anomaly={incident} onClose={() => setIncident(null)} />
    </main>
  );
}

function WaitingHero({ status }: { status: string }) {
  return (
    <div className="flex h-[248px] flex-col items-center justify-center text-center">
      <div className="relative mb-4 flex h-12 w-12 items-center justify-center">
        <span className="absolute h-12 w-12 animate-ping rounded-full border border-accent/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse-soft" />
      </div>
      <p className="text-sm text-muted">
        {status === "offline" || status === "reconnecting"
          ? "Reconnecting to the pipeline…"
          : "Waiting for the firehose…"}
      </p>
      <p className="mt-1 text-xs text-faint">
        Connecting to the live EventStreams feed and warming up detectors.
      </p>
    </div>
  );
}
