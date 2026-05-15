import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import type { AggregatedProduct } from "@/lib/home-blocks";
import { formatCurrency } from "@/lib/constants";

interface Props {
  product: AggregatedProduct;
  badge?: { label: string; variant: "new" | "top" | "sale" };
}

export function HomeProductCard({ product, badge }: Props) {
  const showSale =
    !!product.salePrice &&
    product.salePrice > 0 &&
    product.salePrice < product.basePrice;
  const price =
    product.displayPrice > 0 ? product.displayPrice : product.basePrice;

  const badgeStyle = badge
    ? {
        new: {
          background: "var(--grad-cta)",
          color: "#fff",
        },
        top: {
          background: "rgba(0,240,255,0.14)",
          color: "var(--color-cyan)",
          border: "1px solid rgba(0,240,255,0.55)",
        },
        sale: {
          background: "rgba(255,209,102,0.14)",
          color: "#ffd166",
          border: "1px solid rgba(255,209,102,0.55)",
        },
      }[badge.variant]
    : undefined;

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] transition-all duration-200 hover:-translate-y-px hover:border-cyan/45"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))",
      }}
    >
      <div className="relative aspect-square overflow-hidden bg-black/40">
        {product.image ? (
          <Image
            src={product.image.card}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, rgba(184,41,255,0.45), transparent 60%), #0c0322",
            }}
          />
        )}
        {badge && (
          <span
            className="absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
            style={badgeStyle}
          >
            {badge.label}
          </span>
        )}

        <span className="absolute bottom-3 right-3 z-[2] rounded-lg bg-gradient-to-br from-purple to-magenta px-2.5 py-1.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(184,41,255,0.55)] [font-family:var(--font-orbitron)]">
          {formatCurrency(price)}
        </span>
      </div>

      <div className="px-4 py-4">
        <div>
          {product.brandName && (
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyan">
              {product.brandName}
            </p>
          )}
          <h3 className="mt-1 line-clamp-2 font-sans text-sm font-semibold text-white">
            {product.name}
          </h3>
          {showSale && product.salePrice !== null && (
            <p className="mt-1 font-mono text-[11px] text-white/40 line-through">
              {formatCurrency(product.basePrice)}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            {product.averageRating > 0 ? (
              <>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-3"
                      fill={
                        i < Math.round(product.averageRating)
                          ? "#ffd166"
                          : "transparent"
                      }
                      stroke={
                        i < Math.round(product.averageRating)
                          ? "#ffd166"
                          : "rgba(255,255,255,0.25)"
                      }
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-white/45">
                  ({product.reviewCount})
                </span>
              </>
            ) : (
              <span className="font-mono text-[10px] text-white/30">
                Chưa có đánh giá
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
