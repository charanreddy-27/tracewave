// Single source of truth for identity, links, and shared site metadata.
// Everything that renders a name, link, or contact detail reads from here so
// nothing drifts out of sync across pages.

export const site = {
  name: "Tracewave",
  tagline: "Real-time anomaly detection on a live public firehose",
  // Public production URL. Override at build time with NEXT_PUBLIC_SITE_URL.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://tracewave.vercel.app",
  repo: "https://github.com/charanreddy-27/tracewave",
  // Set when there's a write-up to point at; left blank until then.
  linkedinPost: "",
};

export const author = {
  name: "Chanda Charan Reddy",
  shortName: "Charan",
  title: "AI & Automation Engineer",
  location: "Bangalore, India",
  oneLiner: "I build intelligent systems.",
  email: "charanreddychanda@gmail.com",
  portfolio: "https://www.charanreddy.dev",
  github: "https://github.com/charanreddy-27",
  linkedin: "https://www.linkedin.com/in/chandacharanreddy/",
  calendar: "https://cal.com/charanreddy-27/30min",
  orcid: "https://orcid.org/0009-0003-2414-6717",
} as const;

export const links = {
  dashboard: "/",
  about: "/about",
  project: "/about-project",
} as const;
