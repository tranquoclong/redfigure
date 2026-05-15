"use client";

import Link from "next/link";

export interface BrandStripProps {
  brand: {
    id: string;
    name: string;
    slug?: string;
    description?: string | null;
    productsCount?: number;
  };
}

export function BrandStrip({ brand }: BrandStripProps) {
  const initials = brand.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const href = `/products?brandId=${brand.id}`;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border px-6 py-7 sm:px-8"
      style={{
        borderColor: "rgba(255,0,122,.45)",
        background:
          "linear-gradient(180deg, rgba(184,41,255,.08), rgba(0,0,0,0))",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[60px] -right-[60px] size-[200px] rounded-full opacity-[0.18]"
        style={{ background: "var(--magenta)", filter: "blur(60px)" }}
      />

      <div className="relative grid items-center gap-5 sm:grid-cols-[auto_1fr_auto] sm:gap-6">
        <div
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-full font-display text-xl font-black text-white"
          style={{
            background:
              "linear-gradient(135deg, var(--magenta), var(--purple))",
          }}
        >
          {initials || "RF"}
        </div>

        <div>
          <h3 className="text-lg font-bold text-white">
            Thương hiệu{" "}
            <Link href={href} className="text-white transition hover:text-cyan">
              {brand.name}
            </Link>
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            {brand.description ??
              "Thương hiệu Việt Nam chuyên sản phẩm mô hình"}
            {brand.productsCount != null && brand.productsCount > 0 && (
              <>
                {" "}
                <b className="font-medium text-cyan">
                  {brand.productsCount}{" "}
                  {brand.productsCount === 1 ? "sản phẩm" : "sản phẩm"}
                </b>{" "}
                trong danh mục Red Figure.
              </>
            )}
          </p>
        </div>

        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-cyan/45 bg-cyan/[0.04] px-5 py-2.5 font-display text-[11px] font-semibold uppercase tracking-wider text-cyan transition hover:border-cyan hover:bg-cyan/[0.1] hover:text-white"
        >
          Xem Studio →
        </Link>
      </div>
    </div>
  );
}
