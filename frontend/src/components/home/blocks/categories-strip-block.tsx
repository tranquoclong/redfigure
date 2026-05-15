import Link from "next/link";
import type {
  AggregatedCategory,
  CategoriesStripData,
} from "@/lib/home-blocks";
import { SectionHead } from "./_section-head";

interface Props {
  data: CategoriesStripData;
  categories: AggregatedCategory[];
}

export function CategoriesStripBlock({ data, categories }: Props) {
  if (categories.length === 0) return null;

  return (
    <section
      aria-label={data.title}
      className="mx-auto max-w-[1400px] py-6 sm:py-10 lg:px-8"
    >
      <div className="px-4 sm:px-6 lg:px-0">
        <SectionHead eyebrow={data.eyebrow} title={data.title} />
      </div>

      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 sm:px-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:hidden">
        {categories.map((cat, idx) => {
          const glow = cat.glowColor ?? "var(--color-cyan)";
          const label = cat.displayLabel ?? cat.name;
          const isFirst = idx === 0;
          return (
            <Link
              key={cat.id}
              href={`/c/${cat.slug}`}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 transition-colors ${
                isFirst
                  ? "border-purple/40 bg-purple/[0.14] text-magenta"
                  : "border-white/10 bg-white/[0.04] text-white/72 hover:border-cyan/40 hover:text-white"
              }`}
              style={isFirst ? { ["--g" as "color"]: glow } : undefined}
            >
              <span className="text-[12px] tracking-[0.06em] [font-family:var(--font-orbitron)]">
                {label}
              </span>
              <span className="text-[10px] [font-family:var(--font-mono)] text-white/45">
                {cat.productCount}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="hidden lg:block lg:px-0">
        <div className="grid gap-3 lg:grid-cols-6 xl:grid-cols-6">
          {categories.map((cat, idx) => {
            const num = String(idx + 1).padStart(2, "0");
            const glow = cat.glowColor ?? "var(--color-cyan)";
            const label = cat.displayLabel ?? cat.name;
            return (
              <Link
                key={cat.id}
                href={`/c/${cat.slug}`}
                className="group relative flex aspect-[5/3] flex-col justify-between overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-all hover:-translate-y-0.5 hover:border-cyan/45"
                style={{ ["--g" as "color"]: glow }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60"
                  style={{ background: glow }}
                />
                <div className="relative font-mono text-[11px] tracking-[0.06em] text-cyan">
                  {`// ${num}`}
                </div>
                <div className="relative">
                  <div className="text-base font-bold uppercase tracking-[0.04em] leading-tight text-white">
                    {label}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-white/55">
                    {cat.productCount === 1
                      ? "1 mô hình"
                      : `${cat.productCount} mô hình`}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
