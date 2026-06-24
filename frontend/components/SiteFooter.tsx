import { author, site } from "@/lib/site";

const SOCIAL: { label: string; href: string }[] = [
  { label: "Portfolio", href: author.portfolio },
  { label: "GitHub", href: author.github },
  { label: "LinkedIn", href: author.linkedin },
  { label: "Book a call", href: author.calendar },
];

/** Shared footer for the content pages. Mirrors the portfolio's sign-off. */
export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Crafted with intent.</p>
          <p className="mt-1 text-2xs text-faint">
            <span className="text-accent">●</span> Available for new projects ·{" "}
            {author.location}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs">
          {SOCIAL.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="text-faint uppercase tracking-[0.12em] transition-colors hover:text-accent"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
      <p className="mt-5 text-2xs text-faint">
        © {new Date().getFullYear()} {author.name} · Built with Next.js, FastAPI and a live
        firehose ·{" "}
        <a href={site.repo} target="_blank" rel="noreferrer" className="hover:text-muted">
          source
        </a>
      </p>
    </footer>
  );
}
