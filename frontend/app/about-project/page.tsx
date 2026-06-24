import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Panel } from "@/components/ui";
import { author, site, links } from "@/lib/site";

export const metadata: Metadata = {
  title: "The project",
  description:
    "Why Tracewave exists, how it was built, the parts that broke, and the decisions behind a live streaming-anomaly pipeline.",
};

const TIMELINE: { date: string; title: string; body: string; hard?: boolean }[] = [
  {
    date: "Mar 2026",
    title: "The itch",
    body: "Most data portfolios are a static notebook with a confusion matrix. I wanted the opposite — a system you can watch breathe. Wikimedia publishes every edit on Earth as an open SSE stream. Free, infinite, real. Perfect raw material.",
  },
  {
    date: "Apr 2026",
    title: "Design & scoping",
    body: "Drew the boxes: ingest → bus → windowed processor → online detectors → storage → live UI. Set the rule that would shape everything — the core must run as one process or a distributed stack from the same code.",
  },
  {
    date: "early May 2026",
    title: "MVP — one process, real feed",
    body: "Ingestor, 1-second tumbling windows, and a rolling z-score wired straight to a Next.js chart over WebSockets. Ugly, but alive: real edits drawing a real line within seconds.",
  },
  {
    date: "mid May 2026",
    title: "The part that broke everything",
    hard: true,
    body: "The firehose doesn't burst politely. Unbounded queues ballooned, late events got dropped, and the chart froze on stale values during quiet spells. This is where it got hard: bounded buffers that shed the oldest and count drops, windows that emit rate=0 instead of freezing, and late events folded into the current window. Boring-sounding fixes; the whole thing was a toy until they existed.",
  },
  {
    date: "late May 2026",
    title: "Three detectors and a referee",
    body: "Added EWMA and Half-Space Trees next to the z-score, then the hard part: an ensemble that rewards agreement so one jumpy detector can't cry wolf. Plus the \"why\" — diffing each spike against decaying per-dimension baselines so a card explains itself.",
  },
  {
    date: "early Jun 2026",
    title: "Split, store, observe",
    body: "Proved the transport-agnostic bet: the same Processor moved behind Redis Streams + TimescaleDB with no logic changes. Every service got Prometheus metrics and a Grafana dashboard watching the pipeline's own health.",
  },
  {
    date: "Jun 2026",
    title: "Dashboard polish & launch",
    body: "The NOC-console look, tabular figures, slide-and-settle cards, honest empty/stale states — and a self-contained demo stream so the deployed link is alive without a backend. Shipped.",
  },
];

const FEATURES: { title: string; body: string }[] = [
  {
    title: "Live, explained anomalies",
    body: "Not just \"a spike happened\" — each card carries the contributing dimensions (wiki, language, namespace, actor type), a confidence score, and which detectors corroborated. Every window is replayable.",
  },
  {
    title: "Three detectors, compared",
    body: "Rolling z-score (interpretable baseline), EWMA control chart (adapts to drift), and Half-Space Trees (online, multivariate). The dashboard shows each score over time and an agreement strip.",
  },
  {
    title: "Self-observability",
    body: "Throughput, lag, dropped events, detector fires and p95 window time are all Prometheus metrics, watched by a provisioned Grafana dashboard. The pipeline reports on its own health.",
  },
  {
    title: "Never an empty link",
    body: "A recorded replay loop keeps a demo honest with real captured data, and the deployed frontend falls back to an in-browser simulation when no backend is reachable.",
  },
];

const DECISIONS: { q: string; a: string }[] = [
  {
    q: "Transport-agnostic core",
    a: "The Processor takes events from an abstract bus and writes to an abstract store. In dev that's an in-memory queue and a ring buffer; in prod, Redis Streams and TimescaleDB. Same code, two topologies — the single biggest design lever in the project.",
  },
  {
    q: "Deterministic windowing",
    a: "Windows fold on a caller-supplied clock, not wall time, so the windowing math is unit-tested and reproducible. Quiet periods still emit rate=0 windows so the series — and the detectors — never freeze on a stale value.",
  },
  {
    q: "Agreement-weighted confidence",
    a: "Ensemble confidence is the summed score of detectors that fired divided by the number available — so 3/3 firing at 0.8 reads as 0.80 (corroborated), but 1/3 at 0.8 collapses to 0.27 (suppressed unless very strong). Severity escalates on full agreement.",
  },
  {
    q: "Backpressure as a first-class metric",
    a: "Bounded buffers shed the oldest events under load rather than growing without limit, and every drop is counted, never silently swallowed. You can see the system protecting itself.",
  },
];

const STACK: { name: string; why: string }[] = [
  { name: "Python + httpx", why: "async SSE ingestion that survives reconnects and resumes from the last event id" },
  { name: "Redis Streams", why: "a durable bus with consumer groups and natural backpressure between services" },
  { name: "river", why: "online ML primitives — Half-Space Trees that learn from the stream, no batch retrain" },
  { name: "TimescaleDB", why: "time-series storage that's just Postgres, so queries stay boring and familiar" },
  { name: "FastAPI + WebSockets", why: "low-latency fan-out of metrics and anomalies to every connected dashboard" },
  { name: "Next.js + TypeScript", why: "a typed UI whose wire types mirror the backend's exactly" },
  { name: "Tailwind + uPlot", why: "a tight design system and a canvas chart fast enough to redraw every second" },
  { name: "Prometheus + Grafana", why: "the pipeline watches its own throughput, lag and drops" },
  { name: "Docker Compose", why: "the whole distributed stack comes up with one command" },
];

export default function AboutProjectPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
      <SiteNav />

      <main className="mt-8">
        <header>
          <p className="text-2xs uppercase tracking-[0.16em] text-accent">The project</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Tracewave, from itch to launch
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            A real-time anomaly-detection pipeline pointed at a live public firehose: ingestion, a
            stream bus, windowed processing, three online detectors, time-series storage, and a
            dashboard that catches spikes as they happen. It looks like magic in a notebook and
            falls apart in production — so I built the production version.
          </p>
        </header>

        {/* Why */}
        <section className="mt-10">
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-muted">
            Why it exists
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            I kept seeing &ldquo;data&rdquo; portfolios that were a single static notebook —
            impressive once, dead on arrival. I wanted to show the thing the notebook hides: a live
            distributed system, the full data-platform stack end to end, reacting to real internet
            activity in motion. Wikimedia broadcasts every edit on the planet over an open stream.
            That&apos;s a free, infinite, genuinely unpredictable signal — exactly what you want to
            point an anomaly detector at when you&apos;re trying to prove something runs for real.
          </p>
        </section>

        {/* Timeline */}
        <section className="mt-10">
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-muted">
            How it came together
          </h2>
          <ol className="mt-4 border-l border-line">
            {TIMELINE.map((m) => (
              <li key={m.title} className="relative pb-6 pl-6 last:pb-0">
                <span
                  className={
                    "absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border " +
                    (m.hard
                      ? "border-warn bg-warn/30"
                      : "border-accent-dim bg-accent/40")
                  }
                />
                <div className="flex items-baseline gap-2">
                  <span className="tnum text-2xs uppercase tracking-[0.1em] text-faint">
                    {m.date}
                  </span>
                  {m.hard && (
                    <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-warn">
                      WHERE IT GOT HARD
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-sm font-semibold text-ink">{m.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{m.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section className="mt-10">
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-muted">
            Key features
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-line bg-panel/70 p-4 shadow-panel"
              >
                <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Decisions */}
        <section className="mt-10">
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-muted">
            Interesting decisions &amp; challenges
          </h2>
          <div className="mt-4 space-y-3">
            {DECISIONS.map((d) => (
              <Panel key={d.q} title={d.q}>
                <p className="text-sm leading-relaxed text-muted">{d.a}</p>
              </Panel>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section className="mt-10">
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-muted">
            Tech stack &amp; why
          </h2>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel/70">
            {STACK.map((s) => (
              <div key={s.name} className="flex flex-col gap-1 p-3.5 sm:flex-row sm:gap-4">
                <div className="w-48 shrink-0 text-sm font-medium text-ink">{s.name}</div>
                <div className="text-sm leading-relaxed text-muted">{s.why}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Links + CTA */}
        <section className="mt-10">
          <Panel title="Take it further">
            <div className="flex flex-wrap gap-2">
              <a
                href={site.repo}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-line bg-panel-2/60 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                GitHub repo ↗
              </a>
              {site.linkedinPost ? (
                <a
                  href={site.linkedinPost}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-line bg-panel-2/60 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  LinkedIn write-up ↗
                </a>
              ) : (
                <span
                  className="rounded-lg border border-dashed border-line px-3.5 py-2 text-xs text-faint"
                  title="LinkedIn post link goes here"
                >
                  LinkedIn write-up — soon
                </span>
              )}
              <a
                href={links.dashboard}
                className="rounded-lg border border-line bg-panel-2/60 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                Open the dashboard →
              </a>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted">
              Want to build something or collaborate on something like this?{" "}
              <a
                href={links.about}
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Contact me →
              </a>{" "}
              or reach out directly at{" "}
              <a
                href={`mailto:${author.email}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                {author.email}
              </a>
              .
            </p>
          </Panel>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
