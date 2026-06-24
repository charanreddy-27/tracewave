# Changelog

All notable changes to Tracewave. Format follows [Keep a Changelog](https://keepachangelog.com/);
this project uses date-based releases.

## [1.0.0] — 2026-06

First public release.

### Added
- **Ingestion** — async SSE reader for Wikimedia EventStreams with reconnect + resume-from-id, a
  Wikimedia normaliser, a source registry, and record/replay.
- **Processing** — 1-second tumbling windows on a caller-supplied clock, feature extraction,
  decaying per-dimension baselines, and three online detectors (rolling z-score, EWMA control
  chart, Half-Space Trees via `river`).
- **Ensemble & explainability** — agreement-weighted confidence, info/warn/critical severity, and a
  "why" breakdown that diffs each spike against the baselines and ranks the biggest movers.
- **Transport-agnostic core** — the same `Processor` runs single-process (in-memory bus + ring
  buffer) or distributed (Redis Streams + TimescaleDB).
- **API** — FastAPI with a WebSocket fan-out, snapshot + incremental frames, and an incident-replay
  endpoint.
- **Dashboard** — Next.js + TypeScript + Tailwind + uPlot NOC console: pulse chart, metric tiles,
  detector comparison, anomaly feed/cards, incident modal, honest empty/loading/stale states.
- **Self-observability** — Prometheus metrics across services and a provisioned Grafana dashboard.
- **Tests** — 22 pure-stdlib tests (windows, detectors, ensemble, features, end-to-end).
- **Ops** — Docker Compose stack, Makefile, Prometheus/Grafana provisioning.

### Portfolio polish
- **In-browser demo stream** (`lib/demoStream.ts`) — a labelled `DEMO` simulation with the real
  detector math, so the deployed (serverless) link is alive without a backend. `useLiveStream` tries
  the real WebSocket first and falls back only if no live frame arrives.
- **Narrative routes** — `/about` (the developer) and `/about-project` (why it exists, build
  timeline, decisions, stack) matching the dashboard's design system.
- **Fonts & SEO** — self-hosted Inter + JetBrains Mono via `next/font`, full Open Graph + Twitter
  metadata, an SVG favicon, and a build-time generated social image (`next/og`).
- **Accessibility** — dialog semantics + focus handling on the incident modal, visible focus rings,
  `prefers-reduced-motion` support, and aria labels on icon buttons.
- **Docs** — deep dive, interview prep, and deployment guide under `docs/`.

[1.0.0]: https://github.com/charanreddy-27/tracewave
