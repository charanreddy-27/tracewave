# Tracewave — Project Deep Dive

How the system is built, why it's shaped this way, and how the genuinely hard parts work.
If the [README](../README.md) is the trailer, this is the director's commentary.

---

## 1. The shape of the problem

Wikimedia broadcasts every edit on Earth over an open Server-Sent-Events stream — roughly
30–60 events a second, bursty, never the same twice. The job: turn that firehose into a live
picture of "what's normal right now" and surface the moments that aren't, with enough evidence
that a human trusts the call.

That's not a model problem. It's a **systems** problem wearing a model's clothes. The detector is
maybe 15% of the work; the other 85% is keeping a real-time pipeline honest under load, making the
output explainable, and making the UI read as *alive* rather than *refreshing*.

---

## 2. Architecture at a glance

```
 Wikimedia EventStreams (SSE)
        │  async httpx, reconnect + resume-from-id
        ▼
   ┌──────────┐      raw events       ┌───────────────┐
   │ Ingestor │ ────────────────────▶ │  Stream bus   │   in-memory (dev)
   └──────────┘                       │               │   ⇄ Redis Streams (prod)
                                      └──────┬────────┘
                                             ▼
                          ┌────────────────────────────────────┐
                          │ Processor (transport-agnostic core) │
                          │  • 1s tumbling windows (caller clock)│
                          │  • feature + per-dimension baselines │
                          │  • detectors: z-score / EWMA / HST   │
                          │  • ensemble (agreement) + "why" diff │
                          └───────┬──────────────────┬───────────┘
                          metrics │                  │ anomalies
                                  ▼                  ▼
                        ┌───────────────────────────────────┐
                        │ Store: ring buffer (dev)           │
                        │      ⇄ TimescaleDB (prod)           │
                        └──────────────┬────────────────────┘
                                       ▼
                              ┌─────────────────┐   WS    ┌──────────────┐
                              │ FastAPI + WS hub │ ──────▶ │ Next.js dash │
                              └────────┬─────────┘         └──────────────┘
                                       │ /metrics
                                Prometheus + Grafana
```

**The one decision everything hangs on:** the `Processor` core depends on *abstractions* — a bus
it reads from and a store it writes to — never on Redis or Postgres directly. So the exact same
processing code runs two ways:

- **Dev / demo:** one process, an in-memory `asyncio` bus, a ring-buffer "store". Zero infra.
- **Prod:** ingestor, processor and API split across containers, wired through Redis Streams and
  TimescaleDB.

Swap the topology, not the logic. That's why `python -m tracewave.run.dev` and the full Docker
Compose stack share a code path instead of being two implementations that drift apart.

---

## 3. Data flow, end to end

1. **Ingest.** An async `httpx` client holds the SSE connection open, normalises each event into a
   compact internal shape (`ts`, `id`, `kind`, `actor`, `subject`, `bot`, `bytes_delta`, and a
   `dims` map: domain / lang / kind / namespace / user_type). It reconnects with exponential
   backoff and resumes from the last SSE id so a blip doesn't leave a hole.
2. **Bus.** Events are published to the bus. In prod that's a Redis Stream with a consumer group,
   which gives durability and natural backpressure; in dev it's a bounded in-memory queue.
3. **Window.** The processor folds events into **1-second tumbling windows** on a *caller-supplied
   clock*. Late or out-of-order events fold into the current window rather than being dropped.
   Quiet seconds still emit a `rate=0` window so the series never freezes.
4. **Feature + baseline.** Each window yields a feature vector (rate, distinct subjects/actors,
   bot ratio, bytes/sec, new-page rate). In parallel, per-dimension **decaying baselines** track
   the typical mix of values for each `dim` so the "why" step has something to diff against.
5. **Detect.** Three detectors score the window (see §4). An ensemble combines them.
6. **Explain.** If an anomaly fires, the window is diffed against the baselines and the biggest
   movers are ranked into a `why` list.
7. **Store + push.** Metrics and anomalies go to the store and are fanned out over WebSockets to
   every connected dashboard. The API also exposes `/metrics` for Prometheus.

---

## 4. The detectors (three opinions, compared)

| Detector | Kind | What it's good at | The catch |
|---|---|---|---|
| **Rolling z-score** | windowed, univariate | "N σ above the last 60s" — interpretable | slow to adapt; sensitive to window size |
| **EWMA control chart** | decaying memory, univariate | catches sudden departures while tracking drift | one parameter (α) trades reactivity vs. noise |
| **Half-Space Trees** (`river`) | online, **multivariate** | "this whole moment is weird" across the feature vector | a black box; hard to explain on its own |

None of them is right alone — that's the point. The z-score is interpretable but rigid, EWMA
adapts but can be twitchy, HST sees the whole vector but can't tell you *why*. Showing all three
(and where they agree) is more honest than pretending one number is the truth.

`river` is optional. Without it, HST is marked **unavailable** in the UI and the other two carry
on — the system degrades, it doesn't break.

---

## 5. The hard parts (and how they're solved)

### Backpressure — you don't own the tap
The firehose bursts whenever it likes. Naïve queues grow until the process dies. Tracewave uses
**bounded buffers that shed the oldest events** under pressure, and **counts every drop as a
metric**. The invariant: never grow without limit, never silently swallow. You can watch the
system protect itself on the Grafana dashboard.

### Windows that don't freeze
A real-time chart that holds the last value during a quiet spell is lying. Windows emit `rate=0`
for empty seconds, so the line — and the detectors — keep moving. Windowing folds on a clock
passed in by the caller, which makes the math **deterministic and unit-tested** instead of
dependent on wall-time timing.

### Confidence as a product decision
Three detectors disagree constantly, so a raw "max score" would fire on every twitch. The ensemble
**confidence rewards agreement**: it's the summed score of the detectors that *fired*, divided by
the number *available*.

- 3/3 firing at 0.8 → **0.80** (corroborated, escalates toward *critical*)
- 1/3 firing at 0.8 → **0.27** (suppressed unless very strong)

Severity (info / warn / critical) climbs with agreement. This is the difference between a feed you
trust and a feed you mute.

### The "why" — explainability by diff
Per dimension (wiki, language, namespace, actor type) the processor keeps a **decaying baseline**
of per-value counts. When the rate spikes, it diffs the window against those baselines and ranks
the biggest movers. So a card doesn't say "spike" — it says *"+312 edits, ~98% from
en.wikipedia.org, namespace 0, bot actors."* Each anomaly window is replayable from the feed.

---

## 6. The dashboard (where the polish hides)

The frontend is a calm, low-chroma NOC console — *data is the texture*. The details that matter:

- **Tabular figures everywhere.** Every number renders with `tabular-nums` so digits don't jitter
  as values update — the single biggest tell of an amateur real-time UI.
- **One accent colour** (teal) reserved for live data; a restrained 3-step severity scale.
- **Slide-and-settle**, not pop. Anomaly cards animate in calmly; the chart redraw is capped.
- **Honest states.** A custom "waiting for the firehose…" empty state, loading skeletons, and a
  real connection indicator (`LIVE` / `STALE` / `RECONNECTING` / `OFFLINE`) driven by a watchdog,
  not wishful thinking.
- **Wire types mirror the backend.** `lib/types.ts` is a 1:1 mirror of the server's message shapes,
  so a backend change that the frontend hasn't accounted for fails to compile.

### The demo stream
Because a serverless host can't hold a WebSocket open, `lib/demoStream.ts` simulates the pipeline
in the browser: the same metric/anomaly frames, the same detector math, the same "why" breakdown —
clearly labelled `DEMO`. `useLiveStream` tries the real socket first and falls back only if no live
frame arrives within a grace window. The deployed link is alive on load; a local run with the
backend up uses the genuine feed automatically.

---

## 7. Folder map

```
backend/
  tracewave/
    ingest/        SSE reader, Wikimedia normaliser, replay/record, source registry, runner
    processing/    tumbling windows, features/baselines, detectors/, ensemble, Processor core
    storage/       TimescaleDB store (+ schema) and a NullStore for dev
    api/           FastAPI app, WebSocket fan-out, in-memory history buffer
    run/           entrypoints: ingestor · processor · dev (all-in-one)
    bus.py live.py config.py wire.py metrics.py
  tests/           22 tests (windows, detectors, ensemble, features, end-to-end)
frontend/
  app/             routes: / (dashboard), /about, /about-project, icon + OG image
  components/      Header, PulseChart (uPlot), MetricTiles, DetectorComparison,
                   AnomalyFeed/Card, IncidentModal, Brand/Nav/Footer/ContactCard
  lib/             types (wire mirror), useLiveStream (WS + demo fallback),
                   demoStream (in-browser simulation), format, site (identity)
ops/               prometheus.yml + grafana provisioning & dashboard
docs/              this file, INTERVIEW_PREP, DEPLOYMENT
docker-compose.yml  Makefile
```

---

## 8. Testing

22 tests, pure-stdlib core (no Redis / Timescale / `river` needed to run them):

- windowing math (folding, empty windows, late events)
- each detector's thresholds and edge cases
- the ensemble's agreement / severity / cooldown logic
- the "why" breakdown ranking
- a full end-to-end synthetic-spike run through the real `Processor`

```bash
cd backend && python -m pytest -q     # -> 22 passed
```

---

## 9. Tradeoffs & what I'd revisit

- **SSE over Kafka.** Wikimedia gives SSE; Redis Streams is plenty for this throughput. Kafka would
  be over-engineering at 60 ev/s — but the bus abstraction means swapping it in is a localized change.
- **Three detectors, not ten.** More detectors ≠ better; they'd just add noise to the ensemble. Three
  with *different failure modes* is the sweet spot.
- **In-browser demo vs. server replay.** The replay path uses real captured data; the demo stream is
  synthetic. Both are clearly labelled. If I wanted the deployed link to show *real* data without a
  always-on backend, I'd serve a static recording and replay it client-side.

See [INTERVIEW_PREP.md](INTERVIEW_PREP.md) for "what I'd build next."
