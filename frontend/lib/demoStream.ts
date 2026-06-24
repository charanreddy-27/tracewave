// ─────────────────────────────────────────────────────────────────────────────
// Demo stream — a self-contained simulation of the Tracewave pipeline that runs
// entirely in the browser.
//
// Why this exists: the real dashboard is driven by a FastAPI WebSocket backed by
// the live Wikimedia firehose. A serverless host (Vercel) can't keep that socket
// open, so a deployed link would otherwise sit forever on "waiting for the
// firehose…". This generator produces metric/anomaly frames shaped *exactly* like
// the wire protocol — same fields, same detector math, same "why" breakdown — so
// the portfolio link is alive the moment it loads.
//
// It is honestly synthetic: the numbers are simulated, never presented as real
// captured traffic. The UI labels it "DEMO" whenever this is the source.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AnomalyMsg,
  Contribution,
  DetectorScore,
  MetricMsg,
  ServerMsg,
} from "./types";

export interface DemoController {
  stop: () => void;
}

const Z_THRESHOLD = 3.2;
const HST_THRESHOLD = 0.85;
const TICK_MS = 1000;
const HISTORY_TICKS = 90; // warm-start so the chart is full immediately

// Realistic-looking dimension values, weighted roughly like the live feed.
const DOMAINS: [string, string, number][] = [
  ["en.wikipedia.org", "en", 30],
  ["commons.wikimedia.org", "commons", 22],
  ["www.wikidata.org", "www", 18],
  ["de.wikipedia.org", "de", 8],
  ["fr.wikipedia.org", "fr", 6],
  ["ru.wikipedia.org", "ru", 5],
  ["es.wikipedia.org", "es", 5],
  ["ja.wikipedia.org", "ja", 4],
];

function gaussian(): number {
  // Box–Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

interface Spike {
  ticksLeft: number;
  duration: number;
  factor: number;
  domain: [string, string];
  botHeavy: boolean;
}

class Simulator {
  private t: number; // current window-end epoch seconds
  private rates: number[] = []; // recent rates for z-score
  private ewmaMean = 42;
  private ewmaVar = 16;
  private cooldown = 0;
  private spike: Spike | null = null;
  private spikePeakSeen = false;

  constructor(startEpoch: number) {
    this.t = startEpoch;
  }

  /** Baseline events/sec: a slow diurnal-ish drift plus noise. */
  private baseline(): number {
    const drift = 8 * Math.sin(this.t / 240); // gentle multi-minute wave
    return 42 + drift;
  }

  private maybeStartSpike() {
    if (this.spike || this.cooldown > 0) return;
    // ~1 in 22 quiet ticks kicks off a spike.
    if (Math.random() < 1 / 22) {
      const [domain, lang] = DOMAINS[Math.floor(Math.random() * 3)]; // a busy wiki
      this.spike = {
        duration: 4 + Math.floor(Math.random() * 6),
        ticksLeft: 0,
        factor: 1.7 + Math.random() * 3.0,
        domain: [domain, lang],
        botHeavy: Math.random() < 0.5,
      };
      this.spike.ticksLeft = this.spike.duration;
      this.spikePeakSeen = false;
    }
  }

  /** Triangular envelope 0..1 across the spike's life (peaks in the middle). */
  private spikeEnvelope(): number {
    if (!this.spike) return 0;
    const { duration, ticksLeft } = this.spike;
    const elapsed = duration - ticksLeft;
    const half = duration / 2;
    return 1 - Math.abs(elapsed - half) / half;
  }

  /** Advance one tick and produce the metric frame (+ maybe an anomaly). */
  next(): { metric: MetricMsg; anomaly: AnomalyMsg | null } {
    this.t += 1;
    this.maybeStartSpike();

    const env = this.spikeEnvelope();
    const base = this.baseline();
    const spikeBoost = this.spike ? base * (this.spike.factor - 1) * env : 0;
    const rate = Math.max(2, base + spikeBoost + gaussian() * 2.4);

    // Rolling z-score over the trailing window (excludes the current value).
    const win = this.rates.slice(-60);
    const mean = win.length ? win.reduce((a, b) => a + b, 0) / win.length : rate;
    const variance =
      win.length > 1
        ? win.reduce((a, b) => a + (b - mean) ** 2, 0) / (win.length - 1)
        : 1;
    const std = Math.sqrt(Math.max(variance, 1));
    const z = (rate - mean) / std;

    // EWMA control chart.
    const alpha = 0.3;
    const ewZ = (rate - this.ewmaMean) / Math.sqrt(Math.max(this.ewmaVar, 1));
    this.ewmaMean = alpha * rate + (1 - alpha) * this.ewmaMean;
    this.ewmaVar = alpha * (rate - this.ewmaMean) ** 2 + (1 - alpha) * this.ewmaVar;

    // Half-Space Trees: a holistic "weirdness" score, elevated during spikes.
    const hst = clamp(0.12 + Math.abs(gaussian()) * 0.05 + env * 0.85, 0, 0.99);

    this.rates.push(rate);
    if (this.rates.length > 120) this.rates.shift();

    const zScore = clamp(z / 4, 0, 1);
    const ewScore = clamp(ewZ / 4, 0, 1);
    const detectors: DetectorScore[] = [
      { name: "zscore", score: zScore, flag: z >= Z_THRESHOLD, z, available: true },
      { name: "ewma", score: ewScore, flag: ewZ >= Z_THRESHOLD, z: ewZ, available: true },
      { name: "hst", score: hst, flag: hst >= HST_THRESHOLD, z: null, available: true },
    ];

    const dom = this.spike?.domain ?? DOMAINS[0];
    const botRatio = clamp(
      0.46 + (this.spike?.botHeavy ? env * 0.4 : -env * 0.12) + gaussian() * 0.02,
      0.05,
      0.95,
    );

    const metric: MetricMsg = {
      type: "metric",
      t: this.t,
      rate,
      count: Math.round(rate),
      distinct_subjects: Math.round(rate * (0.82 + Math.random() * 0.1)),
      distinct_actors: Math.round(rate * (0.55 + Math.random() * 0.1)),
      bot_ratio: botRatio,
      bytes_per_sec: Math.round(rate * (240 + Math.random() * 120)),
      new_rate: Math.max(0, Math.round(rate * 0.08 + gaussian())),
      detectors,
      top: {
        domain: [[dom[0], Math.round(rate * (env > 0.3 ? 0.6 : 0.32))]],
        lang: [[dom[1], Math.round(rate * (env > 0.3 ? 0.58 : 0.3))]],
      },
    };

    // Emit at most one anomaly per spike, at its peak, once detectors corroborate.
    let anomaly: AnomalyMsg | null = null;
    const fired = detectors.filter((d) => d.flag);
    const atPeak = this.spike && this.spike.ticksLeft <= Math.ceil(this.spike.duration / 2);
    if (this.spike && atPeak && !this.spikePeakSeen && fired.length >= 1) {
      this.spikePeakSeen = true;
      anomaly = this.buildAnomaly(metric, detectors, mean);
    }

    if (this.spike) {
      this.spike.ticksLeft -= 1;
      if (this.spike.ticksLeft <= 0) {
        this.spike = null;
        this.cooldown = 6 + Math.floor(Math.random() * 8);
      }
    } else if (this.cooldown > 0) {
      this.cooldown -= 1;
    }

    return { metric, anomaly };
  }

  private buildAnomaly(
    metric: MetricMsg,
    detectors: DetectorScore[],
    expected: number,
  ): AnomalyMsg {
    const fired = detectors.filter((d) => d.flag);
    const available = detectors.length;
    const agreement = fired.length;
    // Ensemble confidence rewards agreement: summed score of detectors that
    // fired, divided by detectors available (mirrors the backend).
    const score = clamp(
      fired.reduce((s, d) => s + d.score, 0) / available,
      0,
      1,
    );
    const severity = agreement >= 3 ? "critical" : agreement === 2 ? "warn" : "info";

    const dom = this.spike?.domain ?? DOMAINS[0];
    const excessTotal = Math.max(1, metric.rate - expected);
    const why: Contribution[] = [
      {
        dim: "domain",
        value: dom[0],
        observed: Math.round(metric.rate * 0.62),
        baseline: Math.round(expected * 0.3),
        excess: Math.round(excessTotal * 0.7),
        share: 0.66 + Math.random() * 0.2,
      },
      {
        dim: "namespace",
        value: "0",
        observed: Math.round(metric.rate * 0.5),
        baseline: Math.round(expected * 0.34),
        excess: Math.round(excessTotal * 0.4),
        share: 0.42 + Math.random() * 0.15,
      },
      {
        dim: "user_type",
        value: this.spike?.botHeavy ? "bot" : "human",
        observed: Math.round(metric.rate * 0.45),
        baseline: Math.round(expected * 0.3),
        excess: Math.round(excessTotal * 0.3),
        share: 0.3 + Math.random() * 0.15,
      },
      {
        dim: "lang",
        value: dom[1],
        observed: Math.round(metric.rate * 0.4),
        baseline: Math.round(expected * 0.26),
        excess: Math.round(excessTotal * 0.22),
        share: 0.24 + Math.random() * 0.12,
      },
    ];

    const detectorResults = detectors.map((d) => ({
      name: d.name,
      flag: d.flag,
      score: d.score,
      value: metric.rate,
      expected,
      detail:
        d.name === "hst"
          ? { unavailable: false, score: d.score }
          : { z: d.z, unavailable: false },
    }));

    return {
      type: "anomaly",
      id: `demo-${metric.t}-${Math.random().toString(36).slice(2, 7)}`,
      ts: metric.t,
      metric: "rate",
      value: metric.rate,
      expected,
      severity,
      score,
      agreement,
      detectors: detectorResults,
      why,
      window_start: metric.t - 1,
      window_end: metric.t,
    };
  }
}

export function startDemoStream(onMsg: (m: ServerMsg) => void): DemoController {
  const now = Math.floor(Date.now() / 1000);
  const sim = new Simulator(now - HISTORY_TICKS - 1);

  // Warm-start: replay HISTORY_TICKS of windows up to "now" as a snapshot, so
  // the chart and tiles are populated instantly instead of filling for a minute.
  const metrics: MetricMsg[] = [];
  const seedAnomalies: AnomalyMsg[] = [];
  for (let i = 0; i < HISTORY_TICKS; i++) {
    const { metric, anomaly } = sim.next();
    metrics.push(metric);
    if (anomaly) seedAnomalies.push(anomaly);
  }

  onMsg({
    type: "snapshot",
    server_time: now,
    tick_seconds: 1,
    source: "demo",
    metrics,
    anomalies: seedAnomalies.reverse().slice(0, 20),
  });

  const timer = setInterval(() => {
    const { metric, anomaly } = sim.next();
    onMsg(metric);
    if (anomaly) onMsg(anomaly);
  }, TICK_MS);

  return { stop: () => clearInterval(timer) };
}
