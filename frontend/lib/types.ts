// Wire types — mirror tracewave/wire.py and models.py exactly.

export interface DetectorScore {
  name: string;
  score: number;
  flag: boolean;
  z: number | null;
  available: boolean;
}

export interface MetricMsg {
  type: "metric";
  t: number; // window end, epoch seconds
  ws?: number;
  rate: number;
  count: number;
  distinct_subjects: number;
  distinct_actors: number;
  bot_ratio: number;
  bytes_per_sec: number;
  new_rate: number;
  detectors: DetectorScore[];
  top: { domain?: [string, number][]; lang?: [string, number][] };
}

export interface DetectorResult {
  name: string;
  flag: boolean;
  score: number;
  value: number;
  expected: number;
  detail: Record<string, unknown>;
}

export interface Contribution {
  dim: string;
  value: string;
  observed: number;
  baseline: number;
  excess: number;
  share: number;
}

export type Severity = "info" | "warn" | "critical";

export interface AnomalyMsg {
  type: "anomaly";
  id: string;
  ts: number;
  metric: string;
  value: number;
  expected: number;
  severity: Severity;
  score: number;
  agreement: number;
  detectors: DetectorResult[];
  why: Contribution[];
  window_start: number;
  window_end: number;
}

export interface SnapshotMsg {
  type: "snapshot";
  server_time: number;
  tick_seconds: number;
  source: string;
  metrics: MetricMsg[];
  anomalies: AnomalyMsg[];
}

export type ServerMsg = MetricMsg | AnomalyMsg | SnapshotMsg;

export type ConnState = "connecting" | "live" | "stale" | "reconnecting" | "offline";
