import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ContactCard } from "@/components/ContactCard";
import { Panel } from "@/components/ui";
import { author, links } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Charan — AI & Automation Engineer. The person behind Tracewave, and a door to the rest of the work.",
};

const LEARNINGS: { title: string; body: string }[] = [
  {
    title: "Real-time UIs live or die on the small stuff",
    body: "Tabular figures so digits don't jitter on every tick, a capped and interpolated chart redraw, cards that slide-and-settle instead of popping. None of it shows up in a screenshot — all of it is the difference between \"looks live\" and \"looks amateur.\"",
  },
  {
    title: "Write the core so transport is an afterthought",
    body: "The Processor doesn't know if its events come from an in-memory queue or Redis Streams, or whether history lands in a ring buffer or TimescaleDB. That one decision is why the whole thing runs as a single process in dev and a distributed stack in prod without a rewrite.",
  },
  {
    title: "Confidence is a product decision, not a formula",
    body: "Three detectors will disagree constantly. The interesting work was making the ensemble reward agreement — so one twitchy detector can't cry wolf, but three nodding together escalate to critical. That math is a UX choice wearing a lab coat.",
  },
  {
    title: "Backpressure isn't optional when you don't own the tap",
    body: "The firehose bursts whenever it feels like it. Bounded buffers that shed the oldest events and count every drop as a metric beat unbounded queues that quietly grow until something falls over.",
  },
  {
    title: "A link that's alive beats ten perfect notebooks",
    body: "So this deploys with a self-contained simulation that kicks in when there's no backend — the same detector math, clearly labelled as synthetic. A portfolio link should never greet you with a spinner that never resolves.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
      <SiteNav />

      <main className="mt-8">
        <header>
          <p className="text-2xs uppercase tracking-[0.16em] text-accent">About</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Hi, I&apos;m Charan.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            I&apos;m an AI &amp; automation engineer in Bangalore who ships production LLM systems —
            from a Springer-published model that reads chest X-rays well enough for a radiologist to
            take seriously, to document pipelines that quietly run themselves. Before any of that, I
            wrote real-time control code for jet engines at DRDO, where a millisecond of lag
            isn&apos;t a bug — it&apos;s a flameout. Tracewave is what happens when that instinct for
            things-that-must-not-stall meets a public data firehose and a free weekend.
          </p>
        </header>

        <div className="mt-6 rounded-xl border border-line bg-panel-2/40 px-5 py-4">
          <p className="text-sm leading-relaxed text-muted">
            This is one project. There are{" "}
            <span className="text-ink">18 more (and a few jet engines)</span> over at{" "}
            <a
              href={author.portfolio}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              charanreddy.dev
            </a>
            . Fair warning: it&apos;s a bit of a rabbit hole.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-muted">
            What I learned building this
          </h2>
          <div className="mt-4 space-y-3">
            {LEARNINGS.map((l, i) => (
              <div
                key={l.title}
                className="rounded-xl border border-line bg-panel/70 p-4 shadow-panel"
              >
                <div className="flex items-baseline gap-3">
                  <span className="tnum text-2xs text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{l.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{l.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <Panel title="Elsewhere">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <LinkTile label="Portfolio" sub="charanreddy.dev" href={author.portfolio} accent />
              <LinkTile label="GitHub" sub="the code" href={author.github} />
              <LinkTile label="LinkedIn" sub="say hi" href={author.linkedin} />
              <LinkTile label="Book a call" sub="30 minutes" href={author.calendar} />
            </div>
          </Panel>
        </section>

        <section className="mt-10">
          <p className="mb-4 text-sm leading-relaxed text-muted">
            Want to build something — or break something interesting?{" "}
            <span className="text-ink">Let&apos;s talk.</span>
          </p>
          <ContactCard />
        </section>

        <p className="mt-8 text-center text-2xs text-faint">
          Curious how this was actually built?{" "}
          <a href={links.project} className="text-muted underline-offset-4 hover:text-accent hover:underline">
            Read the project story →
          </a>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

function LinkTile({
  label,
  sub,
  href,
  accent = false,
}: {
  label: string;
  sub: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        "group rounded-lg border p-3 transition-colors " +
        (accent
          ? "border-accent-dim/50 bg-accent-glow hover:border-accent"
          : "border-line bg-base/40 hover:border-line-strong")
      }
    >
      <div
        className={
          "text-sm font-medium " + (accent ? "text-accent" : "text-ink group-hover:text-ink")
        }
      >
        {label}
      </div>
      <div className="text-2xs text-faint">{sub}</div>
    </a>
  );
}
