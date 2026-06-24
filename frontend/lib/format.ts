// Number / time formatting. Everything that renders a number routes through
// here so widths and rounding stay consistent (and tabular-figure friendly).

export function compact(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(digits) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(digits) + "k";
  if (abs >= 100) return n.toFixed(0);
  return n.toFixed(abs < 10 ? digits : 0);
}

export function int(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function pct(n: number, digits = 0): string {
  return (n * 100).toFixed(digits) + "%";
}

export function bytes(n: number): string {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = Math.abs(n);
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return v.toFixed(v < 10 && i > 0 ? 1 : 0) + " " + u[i] + "/s";
}

export function clockTime(epoch: number): string {
  const d = new Date(epoch * 1000);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export function ago(epoch: number, now = Date.now() / 1000): string {
  const s = Math.max(0, Math.round(now - epoch));
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  return h + "h ago";
}

export const severityColor: Record<string, string> = {
  info: "var(--sev-info, #5b9dff)",
  warn: "var(--sev-warn, #f3b24c)",
  critical: "var(--sev-crit, #f4596b)",
};

export function severityLabel(s: string): string {
  return s === "critical" ? "CRITICAL" : s === "warn" ? "WARNING" : "INFO";
}

export function dimLabel(dim: string): string {
  const map: Record<string, string> = {
    domain: "wiki",
    lang: "language",
    kind: "type",
    namespace: "namespace",
    user_type: "actor",
  };
  return map[dim] ?? dim;
}
