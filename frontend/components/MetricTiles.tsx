import type { MetricMsg } from "@/lib/types";
import { compact, int, pct } from "@/lib/format";
import { Sparkline } from "./Sparkline";

interface TileDef {
  key: string;
  label: string;
  unit: string;
  color: string;
  series: number[];
  value: string;
  delta: number | null;
}

function trend(series: number[], lookback = 30): number | null {
  if (series.length < lookback + 1) return null;
  const now = series[series.length - 1];
  const past = series[series.length - 1 - lookback];
  if (past === 0) return null;
  return (now - past) / past;
}

function Tile({ t }: { t: TileDef }) {
  const up = t.delta != null && t.delta > 0.02;
  const down = t.delta != null && t.delta < -0.02;
  return (
    <div className="rounded-xl border border-line bg-panel/80 p-4 shadow-panel">
      <div className="flex items-baseline justify-between">
        <span className="text-2xs uppercase tracking-[0.14em] text-faint">{t.label}</span>
        {t.delta != null && (
          <span
            className={
              "tnum text-2xs " +
              (up ? "text-accent" : down ? "text-warn" : "text-faint")
            }
          >
            {up ? "▲" : down ? "▼" : "•"} {pct(Math.abs(t.delta))}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tnum text-3xl font-semibold leading-none text-ink">{t.value}</span>
        <span className="text-2xs text-faint">{t.unit}</span>
      </div>
      <div className="mt-3 -mb-1">
        <Sparkline data={t.series.slice(-60)} color={t.color} height={30} />
      </div>
    </div>
  );
}

export function MetricTiles({ metrics }: { metrics: MetricMsg[] }) {
  const last = metrics[metrics.length - 1];
  const col = (f: (m: MetricMsg) => number) => metrics.map(f);

  const rates = col((m) => m.rate);
  const pages = col((m) => m.distinct_subjects);
  const editors = col((m) => m.distinct_actors);
  const bots = col((m) => m.bot_ratio);

  const tiles: TileDef[] = [
    {
      key: "rate", label: "Events / sec", unit: "ev/s", color: "#34e3c8",
      series: rates, value: last ? compact(last.rate) : "—", delta: trend(rates),
    },
    {
      key: "pages", label: "Active pages", unit: "/ sec", color: "#5b9dff",
      series: pages, value: last ? int(last.distinct_subjects) : "—", delta: trend(pages),
    },
    {
      key: "editors", label: "Active editors", unit: "/ sec", color: "#9b8cff",
      series: editors, value: last ? int(last.distinct_actors) : "—", delta: trend(editors),
    },
    {
      key: "bots", label: "Bot share", unit: "", color: "#f3b24c",
      series: bots, value: last ? pct(last.bot_ratio) : "—", delta: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Tile key={t.key} t={t} />
      ))}
    </div>
  );
}
