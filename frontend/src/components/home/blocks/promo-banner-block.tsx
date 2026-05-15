import Link from "next/link";
import type { PromoBannerData, PromoCard } from "@/lib/home-blocks";

interface Props {
  data: PromoBannerData;
}

const THEME_STYLE: Record<
  PromoCard["theme"],
  {
    border: string;
    background: string;
    titleGlow: string;
    titleSize: string;
  }
> = {
  magenta: {
    border: "rgba(184,41,255,0.55)",
    background:
      "radial-gradient(70% 80% at 80% 50%, rgba(255,0,122,0.55), transparent 60%), radial-gradient(60% 80% at 10% 80%, rgba(184,41,255,0.45), transparent 60%), linear-gradient(180deg, #1b0a3e, #08021c)",
    titleGlow: "0 0 20px rgba(255,0,122,0.5)",
    titleSize: "text-4xl md:text-[56px]",
  },
  cyan: {
    border: "rgba(0,240,255,0.55)",
    background:
      "radial-gradient(70% 80% at 50% 100%, rgba(0,240,255,0.5), transparent 60%), linear-gradient(180deg, #0a1f3e, #06010f)",
    titleGlow: "0 0 20px rgba(0,240,255,0.5)",
    titleSize: "text-3xl md:text-[25px]",
  },
};

export function PromoBannerBlock({ data }: Props) {
  if (data.cards.length === 0) return null;

  const cards = data.cards.slice(0, 2);

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
      <div
        className={`grid gap-4 ${
          cards.length === 1
            ? "grid-cols-1"
            : "grid-cols-1 md:[grid-template-columns:minmax(0,1.6fr)_minmax(0,1fr)]"
        }`}
      >
        {cards.map((card, idx) => {
          const theme = THEME_STYLE[card.theme] ?? THEME_STYLE.magenta;
          const accentColor =
            card.theme === "magenta"
              ? "var(--color-magenta)"
              : "var(--color-cyan)";
          const Inner = (
            <div
              className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border p-6 sm:rounded-3xl sm:p-9 md:p-12"
              style={{
                borderColor: theme.border,
                background: theme.background,
                minHeight: 240,
              }}
            >
              <div>
                <PromoEyebrow
                  eyebrow={card.eyebrow}
                  accentColor={accentColor}
                />
                <h3
                  className={`mt-3 font-black uppercase tracking-[0.02em] leading-none text-white ${theme.titleSize}`}
                  style={{ textShadow: theme.titleGlow }}
                >
                  {card.title}
                </h3>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/72">
                  {card.description}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {card.ctaLabel && card.ctaHref && (
                  <span
                    className="inline-flex rounded-md px-5 py-2.5 font-display text-xs font-bold uppercase tracking-[0.1em] text-white"
                    style={{
                      background: "var(--grad-cta)",
                      boxShadow: "var(--glow-purple)",
                    }}
                  >
                    {card.ctaLabel}
                  </span>
                )}
                {card.metaText && (
                  <span className="font-mono text-[11px] tracking-[0.06em] text-white/55">
                    {card.metaText}
                  </span>
                )}
              </div>
            </div>
          );
          return card.ctaHref ? (
            <Link
              key={idx}
              href={card.ctaHref}
              className="block transition hover:-translate-y-px hover:brightness-110"
            >
              {Inner}
            </Link>
          ) : (
            <div key={idx}>{Inner}</div>
          );
        })}
      </div>
    </section>
  );
}

function PromoEyebrow({
  eyebrow,
  accentColor,
}: {
  eyebrow: string;
  accentColor: string;
}) {
  const trimmed = eyebrow.trim();
  const match = trimmed.match(/^(\/\/\s*[^·•-]+?)\s*[·•-]\s*(.*)$/);
  const num = match?.[1] ?? trimmed;
  const lbl = match?.[2]?.trim() ?? "";
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs" style={{ color: accentColor }}>
        {num}
      </span>
      {lbl && (
        <>
          <span
            aria-hidden
            className="h-px w-10"
            style={{ background: "var(--grad-rule)" }}
          />
          <span className="font-display text-xs uppercase tracking-[0.18em] text-white">
            {lbl}
          </span>
        </>
      )}
    </div>
  );
}
