"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLink } from "./Brand";
import { author, links } from "@/lib/site";

const NAV = [
  { href: links.dashboard, label: "Dashboard" },
  { href: links.about, label: "About" },
  { href: links.project, label: "The project" },
];

/** Top navigation for the content pages (About / The project). */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
      <BrandLink subtitle="live anomaly detection" />
      <div className="flex items-center gap-1 text-2xs">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "rounded-md px-3 py-1.5 uppercase tracking-[0.12em] transition-colors " +
                (active
                  ? "bg-panel-2 text-ink"
                  : "text-faint hover:bg-panel-2/60 hover:text-muted")
              }
            >
              {item.label}
            </Link>
          );
        })}
        <a
          href={author.portfolio}
          target="_blank"
          rel="noreferrer"
          className="ml-1 hidden rounded-md border border-line px-3 py-1.5 uppercase tracking-[0.12em] text-muted transition-colors hover:border-accent-dim hover:text-accent sm:inline-block"
        >
          Portfolio ↗
        </a>
      </div>
    </nav>
  );
}
