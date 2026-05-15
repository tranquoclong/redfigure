"use client";

import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/constants";

export interface RelatedProductCard {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  brandName?: string;
  price: number;
  salePrice?: number | null;
  averageRating?: number;
  badge?: string;
  isNsfw?: boolean;
}

export interface RelatedProductsCarouselProps {
  eyebrow: string;
  title: string;
  ctaHref?: string;
  ctaLabel?: string;
  products: RelatedProductCard[];
}

export function RelatedProductsCarousel({
  eyebrow,
  title,
  ctaHref,
  ctaLabel = "Xem tất cả →",
  products,
}: RelatedProductsCarouselProps) {
  if (!products.length) return null;

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-cyan">
            {eyebrow}
          </div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white sm:text-2xl">
            {title}
          </h2>
        </div>
        {ctaHref && (
          <Link
            href={ctaHref}
            className="font-mono text-xs uppercase tracking-wider text-cyan transition hover:text-magenta"
          >
            {ctaLabel}
          </Link>
        )}
      </header>

      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/p/${p.slug}`}
            className="group/card flex w-64 shrink-0 snap-start flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition-all duration-[var(--dur-base)] [transition-timing-function:var(--ease-out)] hover:-translate-y-0.5 hover:border-cyan/45 hover:[box-shadow:var(--glow-cyan-sm)]"
          >
            <div className="relative aspect-square overflow-hidden rounded-xl bg-ink-soft">
              <Image
                src={p.imageUrl}
                alt={p.name}
                fill
                sizes="256px"
                className="object-cover transition-transform duration-[var(--dur-slow)] [transition-timing-function:var(--ease-out)] group-hover/card:scale-105"
              />
              {p.isNsfw && (
                <span className="absolute left-2 top-2">
                  <Badge variant="nsfw" className="text-[9px]">
                    HÀNG CAO CẤP
                  </Badge>
                </span>
              )}
              {p.badge && (
                <span className="absolute right-2 top-2">
                  <Badge variant="production" className="text-[9px]">
                    {p.badge}
                  </Badge>
                </span>
              )}

              <span
                className="absolute inset-x-3 bottom-3 mx-auto inline-block rounded-full px-3 py-1 text-center font-display text-sm font-bold uppercase tracking-wide text-white"
                style={{ background: "var(--grad-cta)" }}
              >
                {formatCurrency(p.salePrice ?? p.price)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              {p.brandName && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/55">
                  {p.brandName}
                </span>
              )}
              <h3 className="font-display text-sm font-semibold uppercase leading-tight tracking-wide text-white line-clamp-2">
                {p.name}
              </h3>
              {p.averageRating != null && (
                <div className="flex items-center gap-1 text-xs text-white/55">
                  <Star className="size-3 fill-gold text-gold" />
                  <span>{p.averageRating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
