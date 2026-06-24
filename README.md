# Tracewave

**Real-time anomaly detection on a live public data firehose, with a live ops dashboard.**

Tracewave points a streaming pipeline at [Wikimedia EventStreams](https://stream.wikimedia.org/) — *every Wikipedia edit on Earth, as it happens* — maintains rolling windows, runs three online anomaly detectors in parallel, and pushes both live metrics and explained anomalies to a Next.js dashboard over WebSockets. No refresh, no fake data: real internet activity, analysed in motion.

<p align="center">
  <a href="#quickstart"><b>▶ Live demo</b></a> ·
  <a href="docs/PROJECT_DEEP_DIVE.md">Deep dive</a> ·
  <a href="docs/DEPLOYMENT.md">Deploy</a> ·
  <a href="https://www.charanreddy.dev">Portfolio</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000?logo=next.js"/>
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-WebSockets-009688?logo=fastapi&logoColor=white"/>
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white"/>
  <img alt="Redis" src="https://img.shields.io/badge/Redis-Streams-DC382D?logo=redis&logoColor=white"/>
  <img alt="TimescaleDB" src="https://img.shields.io/badge/TimescaleDB-time--series-FDB515"/>
  <img alt="Tests" src="https://img.shields.io/badge/tests-22%20passing-2ecc71"/>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue"/>
</p>

> Open the dashboard and it's **alive** — events flowing in, sparklines updating, and when something unusual spikes, an anomaly card slides in with the evidence, the contributing dimensions, and a confidence score.

<p align="center"><em>📽️ docs/dashboard.gif — the pulse chart catching a real edit spike (record with the stack running)</em></p>

> **No backend? Still alive.** The deployed dashboard falls back to an in-browser **demo stream** — synthetic data shaped exactly like the real firehose, with the same detector math and "why" breakdown, clearly labelled `DEMO`. A portfolio link should never greet you with a spinner that never resolves.

---

## Why this exists

Most "data" portfolios show a static notebook. Tracewave shows a **live distributed system**: ingestion → a stream bus → windowed stream processing → online ML → time-series storage → a real-time frontend, plus self-observability. It's the full data-platform stack, end to end.

---

## Architecture

```
 Wikimedia EventStreams (SSE, ~30–60 edits/sec)
        │
        ▼
 ┌──────────────┐   raw events   ┌───────────────┐
 │  Ingestor    │ ─────────────▶ │ Redis Streams │  (bus / buffer, backpressure)
 │ (async httpx)│                └───────┬───────┘
 └──────────────┘                        │
                                         ▼
                            ┌───────────────────────────┐
                            │  Stream processor          │
                            │  • tumbling windows (1s)    │
                            │  • feature extraction       │
                            │  • detectors: z-score /     │
                            │    EWMA / Half-Space Trees  │
                            │  • ensemble + "why" diff    │
                            └───────┬───────────┬─────────┘
                          metrics   │           │  anomalies
                                    ▼           ▼
                            ┌───────────────────────────┐
                            │ TimescaleDB (time-series)  │  + Redis pub/sub (live)
                            └───────────┬───────────────┘
                                        │  query + live push
                                ┌───────▼────────┐   WS    ┌──────────────┐
                                │ FastAPI + WS    │ ──────▶ │ Next.js dash │
                                └───────┬─────────┘         └──────────────┘
                                        │ /metrics
                                  Prometheus + Grafana  (pipeline self-health)
```

The whole pipeline is **transport-agnostic**: the same `Processor` core runs either as one process with an in-memory bus (dev) or split across containers wired through Redis + Timescale (prod). Swapping the firehose is one entry in a source registry.

---

## Quickstart

### Option A — single process, zero infra (fastest)

No Docker, no Redis, no Postgres. Runs the entire pipeline in one event loop against the **real** firehose, serving history from an in-memory buffer.

```bash
cd backend
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate ; or use `py`
pip install -e ".[dev]"                            # river/redis/asyncpg optional — see notes
python -m tracewave.run.dev                         # -> http://localhost:8000

# in another terminal
cd frontend
npm install
npm run dev                                         # -> http://localhost:3000
```

The dashboard connects over WebSocket and starts drawing within a couple of seconds.
Half-Space Trees activates automatically once `river` is installed; without it the detector
degrades gracefully (shown as *unavailable* in the UI) and the other two carry on.

### Option B — full distributed stack (Docker)

```bash
make up            # docker compose up --build -d
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API / health | http://localhost:8000/api/health |
| Prometheus | http://localhost:9090 |
| Grafana (anon) | http://localhost:3001 |

`make down` stops it; `make clean` also drops the TimescaleDB volume.

> **Wikimedia User-Agent:** their CDN returns `403` to generic clients. Tracewave sends a
> descriptive UA by default — set your own contact via `TW_USER_AGENT` (see `.env.example`).

### Offline / always-on demo (replay)

So a demo link is never empty, record a slice of the live stream and replay it on a loop
(timestamps are rewritten to *now* each pass — it's real captured data, never fabricated):

```bash
make record        # writes data/sample.jsonl  (a ~685-event sample is included)
make replay        # runs the pipeline from the recording
```

---

## How it works

### Windows
Events are folded into **1-second tumbling windows** on a caller-supplied clock, so windowing
is deterministic and unit-tested. Quiet periods still emit `rate=0` windows, so the series — and
the detectors — never freeze on a stale value. Late/out-of-order events fold into the current
window instead of being dropped.

### Detectors (three opinions, compared)
| Detector | Kind | Catches |
|---|---|---|
| **Rolling z-score** | windowed, univariate | "N σ above the last 60s" — interpretable baseline |
| **EWMA control chart** | decaying memory, univariate | sudden departures while adapting to slow drift |
| **Half-Space Trees** (`river`) | online, **multivariate** | holistic "this moment is weird" over the whole feature vector |

The dashboard's **comparison view** shows each detector's score over time and an agreement strip.

### Ensemble & confidence
Confidence rewards **agreement**: each available detector contributes its score, and the
ensemble confidence is the summed score of the detectors that *fired* divided by the number
*available*. So 3/3 firing at 0.8 → **0.80** (corroborated), but 1/3 firing at 0.8 → **0.27**
(suppressed unless very strong). Severity (info / warn / critical) escalates on full agreement.

### The "why"
Per dimension (wiki, language, namespace, actor-type) Tracewave keeps a decaying baseline of
per-value counts. When the rate spikes it diffs the window against those baselines and ranks the
biggest movers — so a card doesn't just say "spike", it says *"+312 edits, ~98% from
en.wikipedia.org, namespace 0, bot actors"*. Each anomaly window is **replayable** from the feed.

---

## Quality & maturity

- **Backpressure** — the firehose bursts; bounded buffers shed the *oldest* events rather than
  growing without limit or crashing, and drops are counted as a metric, never silently swallowed.
- **Reconnect** — the ingestor reconnects with exponential backoff and resumes from the last SSE
  id; the WebSocket client reconnects with backoff and shows a live connection/`STALE` indicator.
- **Self-observability** — every service exposes Prometheus metrics (throughput, lag, drops,
  detector fires, p95 window time); a provisioned Grafana dashboard watches the pipeline's own health.
- **Tested** — 22 tests cover the windowing math, each detector's thresholds, the ensemble's
  agreement/severity/cooldown logic, the "why" breakdown, and a full end-to-end synthetic-spike
  run through the real `Processor`:

  ```bash
  make test       # cd backend && python -m pytest -q   -> 22 passed
  ```

---

## Design notes (the dashboard)

A calm, low-chroma NOC console — *data is the texture*. One accent reserved for live data; a
restrained 3-step severity scale; **tabular-figure mono for every number** so digits never
jitter as they update (the #1 tell of an amateur real-time UI). Anomaly cards slide-and-settle
rather than pop; the chart redraw is capped and interpolated. Custom empty state
("waiting for the firehose…"), loading skeletons, and an honest connection indicator throughout.

---

## Configuration

All backend settings use the `TW_` prefix (env or `.env`). Highlights:

| Var | Default | Meaning |
|---|---|---|
| `TW_SOURCE` | `wikimedia` | firehose source (registry-driven) |
| `TW_USER_AGENT` | descriptive | required by Wikimedia; set your contact |
| `TW_REDIS_URL` | *(empty)* | empty → in-memory bus; set → Redis Streams |
| `TW_PG_DSN` | *(empty)* | empty → in-memory history; set → TimescaleDB |
| `TW_TICK_SECONDS` | `1.0` | window width |
| `TW_ZSCORE_THRESHOLD` / `TW_EWMA_THRESHOLD` | `3.2` | σ to flag |
| `TW_HST_THRESHOLD` | `0.85` | Half-Space Trees score to flag |
| `TW_REPLAY_FILE` / `TW_REPLAY_SPEED` | *(empty)* / `1` | replay a recording |
| `TW_METRICS_PORT` | `0` | per-process Prometheus endpoint (services) |

Frontend: `NEXT_PUBLIC_WS_URL` (direct WS to the API), `BACKEND_ORIGIN` (REST proxy target).

---

## Project layout

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
frontend/          Next.js + TypeScript + Tailwind + uPlot dashboard
ops/               prometheus.yml + grafana provisioning & dashboard
docker-compose.yml  Makefile
```

---

## Tech stack

Python · `httpx` (async SSE) · Redis Streams · `river` (online ML) · TimescaleDB · FastAPI +
WebSockets · Prometheus + Grafana · Next.js + TypeScript + Tailwind + uPlot · Docker Compose.

The dashboard also ships two narrative routes — **`/about`** (the person behind it) and
**`/about-project`** (why it exists, the build timeline, and the decisions that shaped it).

## Deploy

Dashboard on **Vercel** (root directory `frontend/`); consumer + API on Fly.io / Render
(point `TW_REDIS_URL` / `TW_PG_DSN` at managed instances), then set `NEXT_PUBLIC_WS_URL` to the
public API. With no API wired up, the frontend automatically runs its demo stream, so the link is
never empty. Step-by-step (with the manual checklist) lives in **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Docs

- **[docs/PROJECT_DEEP_DIVE.md](docs/PROJECT_DEEP_DIVE.md)** — architecture, data flow, folder map, and how the hard parts work.
- **[docs/INTERVIEW_PREP.md](docs/INTERVIEW_PREP.md)** — walkthrough, elevator pitch, STAR stories, likely Q&A.
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — ship it to Vercel + the manual checklist.
- **[CHANGELOG.md](CHANGELOG.md)** · **[CONTRIBUTING.md](CONTRIBUTING.md)**

## About the developer

Built by **Chanda Charan Reddy** (Charan) — an AI & automation engineer in Bangalore who ships
production LLM systems, from a Springer-published model that reads chest X-rays to document
pipelines that run themselves. Before all that, real-time control code for jet engines at DRDO,
where a millisecond of lag isn't a bug — it's a flameout.

This is one project. There are more (and a few jet engines) over at the portfolio.

[**Portfolio →**](https://www.charanreddy.dev) · [GitHub](https://github.com/charanreddy-27) · [LinkedIn](https://www.linkedin.com/in/chandacharanreddy/) · [Book a call](https://cal.com/charanreddy-27/30min)

> Want to build something — or break something interesting? Let's talk.

## License

MIT.
