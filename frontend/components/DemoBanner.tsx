"use client";

import { useState } from "react";

/**
 * Honest notice shown when the dashboard is running on the in-browser demo
 * stream (e.g. the deployed link, where no live backend is reachable).
 */
export function DemoBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="mt-3 flex items-start gap-3 rounded-xl border border-line bg-panel-2/50 px-4 py-3">
      <span className="mt-0.5 shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-accent">
        DEMO
      </span>
      <p className="flex-1 text-xs leading-relaxed text-muted">
        This is a <span className="text-ink">simulated stream</span> — synthetic data shaped
        like the real Wikimedia firehose, so the link is alive without a backend. Every detector,
        score and &ldquo;why&rdquo; breakdown is computed exactly as in production.{" "}
        <span className="text-faint">
          Run the pipeline locally (or point it at a deployed API) for the genuine live feed.
        </span>
      </p>
      <button
        onClick={() => setOpen(false)}
        aria-label="Dismiss demo notice"
        className="shrink-0 rounded-md px-1.5 text-faint transition-colors hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
