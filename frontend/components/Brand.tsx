import Link from "next/link";

/** The boxed waveform mark. One definition, reused in the header, nav and footer. */
export function BrandMark({ size = 36 }: { size?: number }) {
  const inner = Math.round(size * 0.56);
  return (
    <div
      className="grid place-items-center rounded-lg border border-line-strong bg-panel-2"
      style={{ width: size, height: size }}
    >
      <svg width={inner} height={inner} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M1 10 H4 L6 4 L9 16 L12 7 L14 12 H19"
          stroke="#34e3c8"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** Brand mark + wordmark, linking home. */
export function BrandLink({ subtitle }: { subtitle?: string }) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <BrandMark />
      <div>
        <div className="text-lg font-semibold leading-tight tracking-tight text-ink">
          Tracewave
        </div>
        {subtitle && <p className="text-2xs text-faint">{subtitle}</p>}
      </div>
    </Link>
  );
}
