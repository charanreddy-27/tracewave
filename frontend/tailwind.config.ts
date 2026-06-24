import type { Config } from "tailwindcss";

/**
 * Tracewave design tokens. A calm, low-chroma NOC console:
 *  - near-black base, a few panel elevations, hairline borders
 *  - ONE accent (teal-cyan) reserved for live data
 *  - a restrained 3-step severity scale (info / warn / critical)
 *  - tabular-figure mono for every number so digits never jitter on update
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#090b0f",
        panel: "#0f1218",
        "panel-2": "#131823",
        line: "#1b212c",
        "line-strong": "#28303d",
        ink: "#e7ebf2",
        muted: "#8b94a4",
        faint: "#59616f",
        accent: "#34e3c8",
        "accent-dim": "#1f8f80",
        "accent-glow": "rgba(52,227,200,0.14)",
        info: "#5b9dff",
        warn: "#f3b24c",
        crit: "#f4596b",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "-apple-system",
          "Segoe UI", "Roboto", "Helvetica Neue", "sans-serif",
        ],
        mono: [
          "var(--font-mono)", "ui-monospace", "SFMono-Regular", "JetBrains Mono", "Menlo",
          "Consolas", "Liberation Mono", "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 30px -12px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(52,227,200,0.25), 0 0 24px -6px rgba(52,227,200,0.35)",
      },
      keyframes: {
        "slide-settle": {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.99)" },
          "60%": { opacity: "1" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        flash: {
          "0%": { color: "var(--tw-prose-flash, #34e3c8)" },
          "100%": { color: "inherit" },
        },
      },
      animation: {
        "slide-settle": "slide-settle 360ms cubic-bezier(0.16,1,0.3,1)",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
        flash: "flash 600ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
