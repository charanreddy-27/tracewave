import { ReactNode } from "react";

export function Panel({
  children,
  title,
  right,
  className = "",
  bodyClass = "",
}: {
  children: ReactNode;
  title?: ReactNode;
  right?: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section
      className={
        "rounded-xl border border-line bg-panel/80 shadow-panel backdrop-blur-sm " +
        className
      }
    >
      {(title || right) && (
        <header className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="text-2xs font-medium uppercase tracking-[0.14em] text-muted">
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className={"px-4 pb-4 " + bodyClass}>{children}</div>
    </section>
  );
}

export function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
          style={{ background: color }}
        />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ background: color }}
      />
    </span>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-2xs uppercase tracking-[0.14em] text-faint">{children}</span>
  );
}
