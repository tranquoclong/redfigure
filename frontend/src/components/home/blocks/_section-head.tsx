import Link from "next/link";

export interface SectionHeadProps {
  eyebrow: string;
  title: string;
  more?: { label: string; href: string };

  rightSlot?: React.ReactNode;
}

export function SectionHead({
  eyebrow,
  title,
  more,
  rightSlot,
}: SectionHeadProps) {
  const trimmed = eyebrow.trim();
  const match = trimmed.match(/^(\/\/\s*[\w-]+)\s*[·•-]?\s*(.*)$/);
  const num = match?.[1] ?? trimmed;
  const lbl = match?.[2]?.trim() ?? "";

  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-3">
          <span className="font-mono text-xs text-cyan">{num}</span>
          {lbl && (
            <>
              <span
                aria-hidden
                className="h-px w-12"
                style={{ background: "var(--grad-rule)" }}
              />
              <span className="text-xs uppercase tracking-[0.18em] text-white/72">
                {lbl}
              </span>
            </>
          )}
        </div>
        <h2 className="text-3xl font-black uppercase tracking-[0.02em] text-white sm:text-4xl md:text-[36px]">
          {title}
        </h2>
      </div>
      {more && (
        <Link
          href={more.href}
          className="hidden shrink-0 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 font-display text-xs uppercase tracking-[0.1em] text-white/72 transition hover:border-cyan/55 hover:bg-cyan/[0.04] hover:text-cyan sm:inline-flex"
        >
          {more.label}
        </Link>
      )}
      {rightSlot}
    </div>
  );
}
