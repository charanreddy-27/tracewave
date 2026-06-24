"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnomalyMsg, ConnState, MetricMsg, ServerMsg } from "./types";
import { startDemoStream, type DemoController } from "./demoStream";

const MAX_METRICS = 600; // ~10 min at 1s ticks
const MAX_ANOMALIES = 120;
// If no real frame arrives this fast, fall back to the in-browser demo stream so
// a deployed (backendless) link is never stuck on the waiting state.
const DEMO_FALLBACK_MS = 3500;

export type StreamMode = "live" | "demo";

function resolveWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const port = process.env.NEXT_PUBLIC_WS_PORT || "8000";
  return `${proto}//${window.location.hostname}:${port}/ws`;
}

export interface LiveState {
  status: ConnState;
  mode: StreamMode;
  metrics: MetricMsg[];
  anomalies: AnomalyMsg[];
  latest: MetricMsg | null;
  source: string;
  tickSeconds: number;
  totalAnomalies: number;
}

export function useLiveStream(): LiveState {
  const [metrics, setMetrics] = useState<MetricMsg[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyMsg[]>([]);
  const [status, setStatus] = useState<ConnState>("connecting");
  const [mode, setMode] = useState<StreamMode>("live");
  const [source, setSource] = useState<string>("wikimedia");
  const [tickSeconds, setTickSeconds] = useState<number>(1);
  const [totalAnomalies, setTotalAnomalies] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const demoRef = useRef<DemoController | null>(null);
  const lastMsgRef = useRef<number>(0);
  const attemptRef = useRef<number>(0);
  const closedRef = useRef<boolean>(false);
  const gotRealRef = useRef<boolean>(false);

  const handle = useCallback((msg: ServerMsg) => {
    lastMsgRef.current = Date.now();
    if (msg.type === "snapshot") {
      setSource(msg.source);
      setTickSeconds(msg.tick_seconds || 1);
      setMetrics(msg.metrics.slice(-MAX_METRICS));
      setAnomalies(msg.anomalies.slice(0, MAX_ANOMALIES));
      setTotalAnomalies(msg.anomalies.length);
      setStatus("live");
    } else if (msg.type === "metric") {
      setStatus("live");
      setMetrics((prev) => {
        const next = prev.length >= MAX_METRICS ? prev.slice(1) : prev.slice();
        next.push(msg);
        return next;
      });
    } else if (msg.type === "anomaly") {
      setAnomalies((prev) => [msg, ...prev].slice(0, MAX_ANOMALIES));
      setTotalAnomalies((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    closedRef.current = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let fallbackTimer: ReturnType<typeof setTimeout>;

    const startDemo = () => {
      if (demoRef.current || closedRef.current) return;
      // Stop chasing the (absent) backend and run the simulation instead.
      wsRef.current?.close();
      clearTimeout(reconnectTimer);
      setMode("demo");
      setStatus("live");
      demoRef.current = startDemoStream(handle);
    };

    const connect = () => {
      const url = resolveWsUrl();
      if (!url) {
        startDemo();
        return;
      }
      setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        lastMsgRef.current = Date.now();
        setStatus("live");
      };
      ws.onmessage = (e) => {
        try {
          gotRealRef.current = true;
          clearTimeout(fallbackTimer);
          handle(JSON.parse(e.data) as ServerMsg);
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        if (!closedRef.current && !demoRef.current) scheduleReconnect();
      };
      ws.onerror = () => {
        ws.close();
      };
    };

    const scheduleReconnect = () => {
      if (demoRef.current) return;
      attemptRef.current += 1;
      setStatus("reconnecting");
      const backoff = Math.min(8000, 500 * 2 ** Math.min(attemptRef.current, 4));
      reconnectTimer = setTimeout(connect, backoff);
    };

    connect();

    // No real frame within the grace window → assume there's no backend here
    // and switch to the demo stream.
    fallbackTimer = setTimeout(() => {
      if (!gotRealRef.current) startDemo();
    }, DEMO_FALLBACK_MS);

    // Stale-link watchdog: if the firehose goes quiet but the socket is open,
    // surface "stale" rather than pretending the (frozen) last value is fresh.
    const watchdog = setInterval(() => {
      if (demoRef.current) return;
      const silent = Date.now() - lastMsgRef.current;
      const open = wsRef.current?.readyState === WebSocket.OPEN;
      if (open && silent > Math.max(4000, tickSeconds * 1000 * 4)) {
        setStatus((s) => (s === "live" ? "stale" : s));
      }
    }, 1000);

    return () => {
      closedRef.current = true;
      clearTimeout(reconnectTimer);
      clearTimeout(fallbackTimer);
      clearInterval(watchdog);
      wsRef.current?.close();
      demoRef.current?.stop();
      demoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  const latest = metrics.length ? metrics[metrics.length - 1] : null;
  return { status, mode, metrics, anomalies, latest, source, tickSeconds, totalAnomalies };
}
