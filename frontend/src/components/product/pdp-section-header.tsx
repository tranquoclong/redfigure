import Link from "next/link";

export interface PdpSectionHeaderProps {
  num: string;

  eyebrow: string;

  title: string;

  more?: { href: string; label?: string };
}

export function PdpSectionHeader({
  num,
  eyebrow,
  title,
  more,
}: PdpSectionHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-cyan">{`// ${num}`}</span>
          <span
            aria-hidden
            className="block h-px w-8"
            style={{ background: "var(--grad-rule)" }}
          />
          <span className="font-display text-[11px] font-medium uppercase tracking-widest text-white/70">
            {eyebrow}
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-black uppercase tracking-wide text-white sm:text-3xl">
          {title}
        </h2>
      </div>

      {more && (
        <Link
          href={more.href}
          className="font-display text-[11px] font-semibold uppercase tracking-widest text-cyan transition hover:text-white"
        >
          {more.label ?? "Xem thêm"} →
        </Link>
      )}
    </div>
  );
}
