"use client";

import "uplot/dist/uPlot.min.css";
import { useEffect, useRef } from "react";
import type { AnomalyMsg, MetricMsg } from "@/lib/types";

const SEV: Record<string, string> = {
  info: "#5b9dff",
  warn: "#f3b24c",
  critical: "#f4596b",
};

/** Paints a vertical marker at each anomaly's timestamp, coloured by severity. */
function anomalyPlugin(getAnoms: () => AnomalyMsg[]) {
  return {
    hooks: {
      draw: (u: any) => {
        const ctx: CanvasRenderingContext2D = u.ctx;
        const { left, top, width, height } = u.bbox;
        const xmin = u.scales.x.min;
        const xmax = u.scales.x.max;
        ctx.save();
        for (const a of getAnoms()) {
          if (a.ts < xmin || a.ts > xmax) continue;
          const cx = Math.round(u.valToPos(a.ts, "x", true));
          const color = SEV[a.severity] ?? SEV.info;
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(cx, top);
          ctx.lineTo(cx, top + height);
          ctx.stroke();
          // marker triangle at the top
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(cx - 4, top);
          ctx.lineTo(cx + 4, top);
          ctx.lineTo(cx, top + 6);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        void left;
        void width;
      },
    },
  };
}

function makeOpts(
  uPlot: any,
  width: number,
  height: number,
  getAnoms: () => AnomalyMsg[],
): any {
  return {
    width,
    height,
    padding: [12, 8, 4, 8],
    cursor: {
      y: false,
      points: { size: 6, width: 2 },
      drag: { x: false, y: false },
    },
    legend: { show: false },
    scales: { x: { time: true }, y: { range: (u: any, min: number, max: number) => [0, Math.max(5, max * 1.15)] } },
    axes: [
      {
        stroke: "#59616f",
        grid: { stroke: "rgba(40,48,61,0.45)", width: 1 },
        ticks: { show: false },
        font: "11px ui-monospace, monospace",
        values: (u: any, splits: number[]) =>
          splits.map((s) =>
            new Date(s * 1000).toLocaleTimeString("en-US", { hour12: false }),
          ),
      },
      {
        stroke: "#59616f",
        grid: { stroke: "rgba(40,48,61,0.45)", width: 1 },
        ticks: { show: false },
        size: 44,
        font: "11px ui-monospace, monospace",
      },
    ],
    series: [
      {},
      {
        stroke: "#34e3c8",
        width: 2,
        points: { show: false },
        fill: (u: any) => {
          const grad = u.ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
          grad.addColorStop(0, "rgba(52,227,200,0.22)");
          grad.addColorStop(1, "rgba(52,227,200,0.0)");
          return grad;
        },
      },
    ],
    plugins: [anomalyPlugin(getAnoms)],
  };
}

export function PulseChart({
  metrics,
  anomalies,
  windowSeconds = 120,
  height = 240,
}: {
  metrics: MetricMsg[];
  anomalies: AnomalyMsg[];
  windowSeconds?: number;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const uRef = useRef<any>(null);
  const anomRef = useRef<AnomalyMsg[]>(anomalies);
  anomRef.current = anomalies;

  useEffect(() => {
    let u: any;
    let ro: ResizeObserver | undefined;
    let cancelled = false;
    (async () => {
      const uPlot = (await import("uplot")).default;
      if (cancelled || !elRef.current) return;
      const w = elRef.current.clientWidth || 600;
      u = new uPlot(makeOpts(uPlot, w, height, () => anomRef.current), [[], []], elRef.current);
      uRef.current = u;
      ro = new ResizeObserver(() => {
        if (elRef.current) u.setSize({ width: elRef.current.clientWidth, height });
      });
      ro.observe(elRef.current);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      u?.destroy();
      uRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const u = uRef.current;
    if (!u) return;
    const xs = metrics.map((m) => m.t);
    const ys = metrics.map((m) => m.rate);
    u.setData([xs, ys]);
    if (xs.length) {
      const max = xs[xs.length - 1];
      u.setScale("x", { min: max - windowSeconds, max });
    }
  }, [metrics, windowSeconds]);

  return <div ref={elRef} style={{ height }} className="w-full" />;
}
