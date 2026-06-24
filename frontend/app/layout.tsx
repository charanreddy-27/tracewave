import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { site, author } from "@/lib/site";
import "./globals.css";

// Self-hosted at build time by next/font — no runtime request to Google.
// These back the design tokens: Inter for text, JetBrains Mono for every number.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const description =
  "Tracewave points a streaming pipeline at the live Wikimedia firehose — every Wikipedia edit on Earth — runs three online anomaly detectors in parallel, and pushes explained spikes to a real-time dashboard over WebSockets.";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Tracewave — live anomaly detection",
    template: "%s · Tracewave",
  },
  description,
  applicationName: "Tracewave",
  authors: [{ name: author.name, url: author.portfolio }],
  creator: author.name,
  keywords: [
    "anomaly detection",
    "real-time data",
    "stream processing",
    "online machine learning",
    "Wikimedia EventStreams",
    "WebSockets",
    "Next.js",
    "FastAPI",
    "observability",
  ],
  openGraph: {
    type: "website",
    url: site.url,
    siteName: "Tracewave",
    title: "Tracewave — live anomaly detection",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Tracewave — live anomaly detection",
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#090b0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
