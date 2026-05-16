import Link from "next/link";
import type { CustomQuoteData } from "@/lib/home-blocks";

interface Props {
  data: CustomQuoteData;
}

export function CustomQuoteBlock({ data }: Props) {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
      <div
        className="relative overflow-hidden rounded-3xl border p-10 md:p-14"
        style={{
          borderColor: "rgba(0,240,255,0.55)",
          background:
            "radial-gradient(60% 80% at 90% 50%, rgba(0,240,255,0.35), transparent 60%), radial-gradient(60% 80% at 10% 50%, rgba(184,41,255,0.35), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="grid items-center gap-12 md:grid-cols-[1.4fr_1fr]">
          <div>
            <PromoEyebrow eyebrow={data.eyebrow} />
            <h3 className="mt-3 text-[44px] font-black uppercase leading-none tracking-[0.02em] text-white">
              {data.title}
            </h3>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/72">
              {data.description}
            </p>
            <div className="mt-6">
              <Link
                href={data.ctaHref}
                className="inline-flex rounded-md px-7 py-3.5 font-display text-[13px] font-bold uppercase tracking-[0.1em] text-white transition hover:brightness-110 hover:-translate-y-px"
                style={{
                  background: "var(--grad-cta)",
                  boxShadow: "var(--glow-purple)",
                }}
              >
                {data.ctaLabel}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {data.steps.map((step, idx) => {
              const isLast = idx === data.steps.length - 1;
              return (
                <div
                  key={step.number + step.title}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: isLast
                      ? "rgba(184,41,255,0.55)"
                      : "rgba(255,255,255,0.08)",
                    background: isLast
                      ? "rgba(255,0,122,0.08)"
                      : "rgba(0,0,0,0.4)",
                  }}
                >
                  <div
                    className="font-mono text-[10px] tracking-[0.1em]"
                    style={{
                      color: isLast
                        ? "var(--color-magenta)"
                        : "var(--color-cyan)",
                    }}
                  >
                    {`// ${step.number}`}
                  </div>
                  <div className="mt-1.5 font-display text-[13px] font-bold uppercase tracking-[0.04em] text-white">
                    {step.title}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {step.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function PromoEyebrow({ eyebrow }: { eyebrow: string }) {
  const trimmed = eyebrow.trim();
  const match = trimmed.match(/^(\/\/\s*\S+)\s*[·•-]?\s*(.*)$/);
  const num = match?.[1] ?? trimmed;
  const lbl = match?.[2]?.trim() ?? "";
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-cyan">{num}</span>
      {lbl && (
        <>
          <span
            aria-hidden
            className="h-px w-10"
            style={{ background: "var(--grad-rule)" }}
          />
          <span className="text-xs uppercase tracking-[0.18em] text-white/72">
            {lbl}
          </span>
        </>
      )}
    </div>
  );
}
