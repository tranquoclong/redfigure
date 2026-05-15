import Image from "next/image";
import Link from "next/link";
import type { FooterColumn, SocialLink } from "@/lib/site-content";

export interface FooterProps {
  columns: FooterColumn[];
  socials: SocialLink[];
  legal: { copyright: string; mst?: string };
}

export function Footer({ columns, socials, legal }: FooterProps) {
  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-ink-soft/40 text-white/60">
      <div
        className="h-px w-full"
        style={{ background: "var(--grad-rule)" }}
        aria-hidden
      />
      <div className="mx-auto max-w-[1400px] px-6 py-14 grid gap-10 md:grid-cols-5">
        <div className="md:col-span-2">
          <div className="flex items-center">
            <Image
              src="/apple-touch-icon.png"
              width={60}
              height={60}
              quality={75}
              priority={true}
              alt="logo"
              sizes="100vw"
            />
            <p className="px-8 max-w-sm text-sm leading-relaxed text-white/55">
              Mô hình dựa trên truyện tranh, phim truyền hình và điện ảnh tốt
              nhất cho các nhà sưu tập, với giá cả hợp lý và dịch vụ thân thiện
              nhất.
            </p>
          </div>
          <div className="mt-5 flex gap-2">
            {socials.map((social) => (
              <a
                key={social.platform}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.platform}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-wider text-white/70 transition-all duration-[var(--dur-base)] [transition-timing-function:var(--ease-out)] hover:border-cyan/55 hover:text-cyan hover:[box-shadow:var(--glow-cyan-sm)]"
              >
                {social.shortLabel}
              </a>
            ))}
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">
              {"// "}
              {col.title}
            </div>
            <ul className="space-y-2.5 text-sm">
              {col.links.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-white/65 transition-colors hover:text-cyan"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.06] py-5 text-center font-mono text-[11px] uppercase tracking-wider text-white/40">
        {legal.copyright}
        {legal.mst && ` · MST ${legal.mst}`}
        {" · "}
        <span className="text-magenta/70">cao cấp</span>
      </div>
    </footer>
  );
}
