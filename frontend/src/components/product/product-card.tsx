import Link from "next/link";
import Image from "next/image";
import { ROUTES, formatCurrency } from "@/lib/constants";
import { WishlistButton } from "./wishlist-button";
import type { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const images = product.images ?? [];
  const variations = product.variations ?? [];
  const mainImage = images.find((img) => img.isMain) ?? images[0];
  const mainImageUrl = mainImage?.mediaFile?.card ?? mainImage?.url ?? "";

  const isVariable = product.type === "variable";
  const productVariations = product.variations ?? [];

  const isOutOfStock =
    product.type !== "bundle" &&
    (isVariable
      ? productVariations.length > 0 &&
        productVariations.filter((v) => v.manageStock !== false).length > 0 &&
        productVariations
          .filter((v) => v.manageStock !== false)
          .every((v) => (v.availableStock ?? 1) <= 0)
      : product.manageStock !== false && (product.availableStock ?? 1) <= 0);
  const showSale =
    !isVariable && !!product.salePrice && product.salePrice < product.basePrice;

  let tagPrice: { label: string; hasRange: boolean } | null = null;
  if (!showSale) {
    if (isVariable && variations.length > 0) {
      const prices = variations.map((v) => v.salePrice ?? v.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      tagPrice = {
        label: formatCurrency(min) + (min !== max ? "+" : ""),
        hasRange: min !== max,
      };
    } else if (!isVariable) {
      tagPrice = { label: formatCurrency(product.basePrice), hasRange: false };
    }
  }

  return (
    <Link
      href={ROUTES.product(product.slug)}
      className="group relative block overflow-hidden rounded-2xl border border-purple/25 bg-gradient-to-b from-[#160830] to-[#0a0220] transition-all duration-200 hover:-translate-y-1 hover:border-cyan/55 hover:shadow-[0_14px_40px_-10px_rgba(0,240,255,0.35)]"
    >
      <div className="relative aspect-square overflow-hidden">
        {mainImage && mainImageUrl ? (
          <Image
            src={mainImageUrl}
            alt={mainImage.mediaFile?.alt ?? mainImage.altText ?? product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-white/40 text-sm"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 30%, rgba(255,0,122,0.35), transparent 60%), radial-gradient(80% 80% at 50% 90%, rgba(0,240,255,0.25), transparent 70%), linear-gradient(180deg,#1b0a3e,#08021c)",
            }}
          >
            Không có hình ảnh
          </div>
        )}

        {product.featured && (
          <span className="absolute top-2.5 left-2.5 z-[2] rounded-md border border-cyan/50 bg-black/55 px-2 py-1 text-[10px] tracking-[0.12em] uppercase text-[#cdfdff] [font-family:var(--font-orbitron)]">
            NỔI BẬT
          </span>
        )}

        <WishlistButton
          productId={product.id}
          productSlug={product.slug}
          product={product}
          className="absolute top-2 right-2 z-[2] opacity-0 transition-opacity group-hover:opacity-100"
        />

        {/* {tagPrice && !isOutOfStock && (
          <div className="absolute bottom-3 right-3 z-[2] rounded-lg bg-gradient-to-br from-purple to-magenta px-2.5 py-1.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(184,41,255,0.55)] [font-family:var(--font-orbitron)]">
            {tagPrice.label}
          </div>
        )} */}

        {isOutOfStock && (
          <div className="absolute inset-0 z-[3] flex items-center justify-center bg-black/60">
            <span className="rounded-lg border border-white/20 bg-black/70 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/80">
              HẾT HÀNG
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-sm font-bold leading-tight text-white line-clamp-2 group-hover:text-cyan transition-colors">
          {product.name}
        </h3>

        {(product.brand?.name || product.category?.name) && (
          <p className="mt-1.5 text-[11px] uppercase tracking-[0.12em] [font-family:var(--font-mono)] text-white/45">
            {product.brand?.name || product.category?.name}
          </p>
        )}

        {tagPrice && !isOutOfStock && (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-bold text-magenta [font-family:var(--font-orbitron)]">
              {tagPrice.label}
            </span>
          </div>
        )}

        {showSale && (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xs text-white/40 line-through">
              {formatCurrency(product.basePrice)}
            </span>
            <span className="text-base font-bold text-magenta [font-family:var(--font-orbitron)]">
              {formatCurrency(product.salePrice!)}
            </span>
          </div>
        )}
        {isVariable && variations.length > 0 && (
          <p className="mt-1 text-xs text-white/50">
            {variations.length} phiên bản
          </p>
        )}
      </div>
    </Link>
  );
}
