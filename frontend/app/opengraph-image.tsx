import { ImageResponse } from "next/og";

// Social card, generated at build/edge — no static binary to keep in sync.
// Mirrors the dashboard's NOC-console look: near-black base, one teal accent.
export const runtime = "edge";
export const alt = "Tracewave — real-time anomaly detection on a live public firehose";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#090b0f",
          color: "#e7ebf2",
          fontFamily: "sans-serif",
        }}
      >
        {/* Soft brand glow — Satori supports the `circle at` radial form. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(circle at 78% -8%, rgba(52,227,200,0.18), transparent 55%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              border: "1px solid #28303d",
              background: "#0f1218",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
              <path
                d="M6 32 H17 L23 13 L33 51 L42 24 L48 38 H58"
                stroke="#34e3c8"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 26,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#8b94a4",
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 9, background: "#34e3c8" }} />
            Live · WebSocket
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>
            Tracewave
          </div>
          <div style={{ fontSize: 38, color: "#8b94a4", maxWidth: 980, lineHeight: 1.3 }}>
            Real-time anomaly detection on a live public firehose — streaming windows,
            three online detectors, and a dashboard that catches spikes as they happen.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 26,
            color: "#59616f",
          }}
        >
          <span>z-score · EWMA · Half-Space Trees</span>
          <span style={{ color: "#34e3c8" }}>charanreddy.dev</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
