"use client";

import { useState } from "react";
import { Panel } from "./ui";
import { author } from "@/lib/site";

const ACTIONS: { label: string; href: string; accent?: boolean }[] = [
  { label: "Book a call", href: author.calendar, accent: true },
  { label: "Email", href: `mailto:${author.email}` },
  { label: "GitHub", href: author.github },
  { label: "LinkedIn", href: author.linkedin },
  { label: "Resume", href: author.portfolio },
];

/**
 * Contact card mirroring the portfolio's energy. The form composes a prefilled
 * email via the user's mail client — it needs no backend, so it works the same
 * on the deployed (serverless) site as it does locally.
 */
export function ContactCard() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Tracewave — hello from ${name || "the dashboard"}`);
    const body = encodeURIComponent(
      `${message}\n\n— ${name}${email ? ` (${email})` : ""}`,
    );
    window.location.href = `mailto:${author.email}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <Panel title="Have an idea? Let's talk." className="overflow-hidden">
      <p className="max-w-prose text-sm leading-relaxed text-muted">
        Want to build something — or break something interesting? I&apos;m{" "}
        <span className="text-ink">available for new projects</span>. The fastest way to reach
        me is a 30-minute call; otherwise drop a line below and it lands in my inbox.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <a
            key={a.label}
            href={a.href}
            target={a.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noreferrer"
            className={
              "rounded-lg px-3.5 py-2 text-xs font-medium transition-colors " +
              (a.accent
                ? "bg-accent text-base hover:bg-accent/90"
                : "border border-line bg-panel-2/60 text-muted hover:border-line-strong hover:text-ink")
            }
          >
            {a.label}
          </a>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className="w-full rounded-lg border border-line bg-base/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent-dim"
            placeholder="Your name"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-lg border border-line bg-base/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent-dim"
            placeholder="you@company.com"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Message">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              className="w-full resize-y rounded-lg border border-line bg-base/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent-dim"
              placeholder="What are you building?"
            />
          </Field>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-base transition-colors hover:bg-accent/90"
          >
            Send message
          </button>
          {sent && (
            <span className="text-2xs text-faint">
              Opening your mail app — if nothing happens, write to{" "}
              <a className="text-accent" href={`mailto:${author.email}`}>
                {author.email}
              </a>
              .
            </span>
          )}
        </div>
      </form>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-2xs uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}
