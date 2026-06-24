# Tracewave — Interview Prep

Rehearse from this. Read it out loud once or twice; the phrasing is meant to be spoken, not recited.

---

## 30-second elevator pitch

> Tracewave is a real-time anomaly-detection pipeline pointed at the live Wikimedia firehose —
> every Wikipedia edit on Earth, about 30 to 60 a second. It maintains rolling one-second windows,
> runs three online detectors in parallel — a z-score, an EWMA control chart, and Half-Space Trees —
> and pushes explained anomalies to a dashboard over WebSockets. The interesting part isn't the ML;
> it's that the same processing core runs as one process with zero infra or as a distributed stack
> over Redis and TimescaleDB, and that every anomaly explains *why* it fired. It's the full
> data-platform stack, end to end, and it's alive when you open it.

---

## The 2-minute walkthrough

**Start with the why.** "Most data portfolios are a static notebook — impressive once, dead on
arrival. I wanted to build the thing the notebook hides: a live distributed system reacting to real,
unpredictable data."

**Then the spine.** "Wikimedia publishes every edit over an open SSE stream. An async ingestor holds
that connection, normalises each event, and publishes to a bus. A processor folds events into
one-second tumbling windows, extracts features, and scores each window with three detectors."

**Then the two things I'm actually proud of:**

1. *Transport-agnostic core.* "The processor depends on an abstract bus and an abstract store —
   never Redis or Postgres directly. So the exact same code runs in one process for dev, or split
   across containers over Redis Streams and TimescaleDB for prod. I change the topology, not the
   logic."

2. *Explainable anomalies.* "Each detector is one opinion. An ensemble combines them and rewards
   agreement, so one twitchy detector can't cry wolf. And when something fires, I diff the window
   against decaying per-dimension baselines and rank the biggest movers — so a card says '+312 edits,
   98% from en.wikipedia.org, bot actors,' not just 'spike.'"

**Then the systems honesty.** "It handles backpressure by shedding the oldest events under load and
counting every drop as a metric; it reconnects and resumes from the last event id; and the whole
pipeline reports its own health to Prometheus and Grafana."

**Close on the UI.** "The dashboard is built so it reads as *alive*, not *refreshing* — tabular
figures so numbers don't jitter, capped redraws, honest connection states. And because a serverless
host can't hold a WebSocket open, the deployed version falls back to an in-browser simulation with
the same detector math, clearly labelled, so the link is never a dead spinner."

---

## STAR stories

### STAR 1 — Backpressure under a bursty firehose
- **Situation:** The Wikimedia stream bursts unpredictably; my first version used unbounded queues.
- **Task:** Keep the pipeline stable under load without silently losing data or pretending nothing
  happened.
- **Action:** Replaced unbounded queues with bounded buffers that shed the *oldest* events when full,
  and made every drop a counted Prometheus metric. Made windows emit `rate=0` for empty seconds so
  the series never freezes on a stale value, and folded late events into the current window.
- **Result:** The pipeline survives bursts gracefully and *visibly* — you can watch it protect itself
  on the Grafana dashboard. Drops are observable, not mysterious. It went from "toy that falls over"
  to "system you can trust."

### STAR 2 — Making anomalies trustworthy (ensemble + "why")
- **Situation:** With three detectors, a naïve "max score" fired on every minor twitch. The feed was
  noise.
- **Task:** Make the output something a human would actually trust and act on.
- **Action:** Built an ensemble where confidence is the summed score of detectors that *fired*
  divided by the number *available* — so corroboration is rewarded and lone firings are suppressed.
  Layered on an explainability step that diffs each spike against decaying per-dimension baselines
  and ranks the biggest contributors.
- **Result:** A 3/3 agreement at 0.8 reads as 0.80 and escalates to critical; a 1/3 collapses to
  0.27 and stays quiet. Every card explains itself. The feed became signal instead of noise.

### STAR 3 — One core, two topologies
- **Situation:** I wanted both a zero-infra dev experience and a real distributed deployment, without
  maintaining two codebases that drift.
- **Task:** Run identical processing logic in a single process and across a Redis + Timescale stack.
- **Action:** Designed the `Processor` against an abstract bus and store. Dev wires an in-memory queue
  and a ring buffer; prod wires Redis Streams and TimescaleDB — same processing path.
- **Result:** `python -m tracewave.run.dev` and `docker compose up` exercise the same core. The demo
  is trivial to run and the prod story is real, and they can't silently diverge.

---

## Likely technical Q&A

**Q: Why three detectors instead of one good one?**
Because they fail differently. The z-score is interpretable but rigid; EWMA adapts to drift but can
be twitchy; Half-Space Trees sees the whole feature vector but can't explain itself. Showing all
three and where they agree is more honest than pretending one number is the truth — and the ensemble
turns disagreement into a confidence signal.

**Q: Why tumbling windows on a caller-supplied clock?**
Determinism and testability. If windowing depends on wall-time, your tests are flaky and timing-
dependent. Passing the clock in makes the windowing math a pure function I can unit-test exactly,
including late events and empty seconds.

**Q: How do you handle late or out-of-order events?**
They fold into the current window rather than being dropped. For this domain that's the right call —
we care about *now*, and a perfectly ordered late-arrival policy would add latency for marginal
accuracy. If correctness-on-replay mattered more, I'd add watermarking.

**Q: Why Redis Streams and not Kafka?**
At 30–60 events/sec, Kafka is over-engineering. Redis Streams gives me consumer groups, durability
and backpressure with far less operational weight. And the bus is an abstraction — if throughput
demanded Kafka, it's a localized swap, not a rewrite.

**Q: What happens if `river` (the ML lib) isn't installed?**
Half-Space Trees is marked *unavailable* in the UI and the other two detectors carry on. Optional
dependencies degrade, they don't break — same with Redis (falls back to in-memory) and Postgres
(falls back to a ring buffer).

**Q: How is the confidence score actually computed?**
Summed score of the detectors that fired, divided by the number available. It rewards agreement: a
lone firing is mathematically suppressed unless its score is very high, while corroboration pushes
confidence up and escalates severity.

**Q: Isn't the demo stream just fake data?**
It's *clearly-labelled synthetic* data, and it exists for one reason: a serverless host can't keep a
WebSocket open, so the deployed link would otherwise spin forever. It runs the real detector math on
simulated metrics so the UI is honest about what it's showing. The real feed is one env var away.

**Q: How would you scale this to 10× the throughput?**
The processor is already decoupled via the bus, so I'd partition the stream by dimension (e.g. by
wiki) across multiple processor consumers in the same Redis consumer group, and let TimescaleDB's
hypertables handle the write volume. The window math is per-key, so it parallelises cleanly.

**Q: How do you know it works? (testing)**
22 tests covering windowing, each detector's thresholds, the ensemble's agreement/severity/cooldown
logic, the "why" ranking, and a full end-to-end synthetic-spike run through the real `Processor` —
all pure-stdlib, no infra required to run them.

---

## What I'd improve next (shows growth)

- **Watermarking + a small reorder buffer** for stricter late-event handling, behind a flag.
- **A learned baseline per time-of-day** — edit volume has a daily rhythm; a static baseline treats
  the morning ramp as mildly anomalous.
- **Alert routing** — push criticals to a webhook / Slack, with dedup and cooldown already in place.
- **A static recorded-replay deploy** so the public link can show *real* captured data without an
  always-on backend.
- **Per-dimension drill-down** in the UI — click a contributing dimension to filter the whole
  dashboard to it.

---

## Smart questions to ask the interviewer

- Where does this team draw the line between "alert" and "noise" — who owns that threshold, and how
  often does it get retuned?
- When a real-time system degrades, do you prefer it to shed load, buffer, or fail loud? What's the
  cultural default here?
- How much of your data platform is "one core, many topologies" versus separate services per stage?
- What's the thing that breaks most often in production here, and what have you stopped trying to fix?
- For a role like this, what does someone who's thriving six months in actually spend their week doing?
