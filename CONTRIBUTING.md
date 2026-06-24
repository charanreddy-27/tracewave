# Contributing to Tracewave

Thanks for taking a look. This started as a portfolio project, but it's built like real software and
PRs are welcome — especially around new detectors, new firehose sources, and dashboard polish.

## Getting set up

```bash
# Backend (zero infra — runs the whole pipeline in one process against the real feed)
cd backend
python -m venv .venv && . .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
python -m tracewave.run.dev                       # -> http://localhost:8000

# Frontend
cd frontend
npm install
npm run dev                                        # -> http://localhost:3000 (DEMO without a backend)
```

## Before you open a PR

```bash
# Backend
cd backend && python -m pytest -q                  # 22 tests should pass

# Frontend
cd frontend && npm run typecheck && npm run build  # both clean
```

## Ground rules

- **Match the design system.** The dashboard is a deliberate, low-chroma NOC console — one accent
  colour, tabular figures for numbers, restrained motion. New UI should look like it was always
  there. The tokens live in `frontend/tailwind.config.ts`.
- **Keep the core transport-agnostic.** The `Processor` must not import Redis or Postgres directly —
  depend on the bus/store abstractions so single-process and distributed modes stay in sync.
- **Wire types mirror the backend.** If you change a server message shape, update
  `frontend/lib/types.ts` to match.
- **Optional deps degrade, never break.** New optional dependencies (`river`-style) should mark a
  feature *unavailable* rather than crash the pipeline.
- **Test the math.** Windowing, detectors, and the ensemble are unit-tested — add cases for new
  behaviour rather than relying on the live feed.

## Good first contributions

- A new firehose source behind the source registry (the bus/processor won't care).
- A fourth detector with a genuinely different failure mode.
- A per-dimension drill-down in the dashboard.
- Alert routing (webhook/Slack) on top of the existing dedup + cooldown.

Questions? Open an issue, or reach out via the links in the [README](README.md).
