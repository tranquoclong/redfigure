"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Minus, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CartItem, RevalidatedCartItem } from "@/types/cart";

export interface CartItemRowProps {
  item: CartItem;

  revalidated?: RevalidatedCartItem;

  brandName?: string | null;

  productSlug?: string | null;

  productionDays?: number | null;

  onUpdateQuantity: (next: number) => void;
  onRemove: () => void;
}

export function CartItemRow({
  item,
  revalidated,
  brandName,
  productSlug,
  productionDays,
  onUpdateQuantity,
  onRemove,
}: CartItemRowProps) {
  const isOutOfStock = revalidated?.outOfStock === true;
  const priceChanged = revalidated?.priceChanged === true;
  const currentPrice = revalidated?.currentPrice ?? item.price;

  const isQuote = !item.productId;
  const lineTotal = currentPrice * item.quantity;

  const variations: { label: string; value: string }[] = [];
  if (item.scaleName)
    variations.push({ label: "Kích thước", value: item.scaleName });
  if (item.variationName)
    variations.push({
      label: item.variationLabel ?? "Phiên bản",
      value: item.variationName,
    });

  return (
    <article
      className={cn(
        "cart-item-row relative grid grid-cols-[100px_1fr] gap-4 rounded-2xl border p-4 transition-colors duration-[var(--dur-base)] sm:grid-cols-[140px_1fr_auto] sm:gap-[18px] sm:p-[18px]",
        isOutOfStock
          ? "border-red-500/45 bg-red-500/[0.04]"
          : "border-magenta/[0.22] bg-gradient-to-b from-white/[0.02] to-white/[0.005] hover:border-cyan/45",
      )}
    >
      {productSlug ? (
        <Link
          href={`/p/${productSlug}`}
          aria-label={`Xem chi tiết ${item.name}`}
          className="relative size-[100px] shrink-0 overflow-hidden rounded-xl bg-black transition-transform hover:scale-[1.02] sm:size-[140px]"
        >
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 100px, 140px"
              className="object-cover"
            />
          ) : (
            <div
              className="size-full"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 30%, rgba(184,41,255,.45), transparent 60%), #0c0322",
              }}
            />
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 [background:repeating-linear-gradient(180deg,rgba(255,255,255,.03)_0_1px,transparent_1px_3px)] mix-blend-overlay"
          />
        </Link>
      ) : (
        <div className="relative size-[100px] shrink-0 overflow-hidden rounded-xl bg-black sm:size-[140px]">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 100px, 140px"
              className="object-cover"
            />
          ) : (
            <div
              className="size-full"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 30%, rgba(184,41,255,.45), transparent 60%), #0c0322",
              }}
            />
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 [background:repeating-linear-gradient(180deg,rgba(255,255,255,.03)_0_1px,transparent_1px_3px)] mix-blend-overlay"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        {brandName && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-magenta/55 bg-magenta/[0.12] px-2.5 py-[3px] font-display text-[9px] font-medium uppercase tracking-[0.12em] text-magenta">
            <span
              aria-hidden
              className="size-1 rounded-full bg-magenta shadow-[0_0_4px_var(--magenta)]"
            />
            {brandName}
          </span>
        )}

        {productSlug ? (
          <Link
            href={`/p/${productSlug}`}
            className="text-[17px] font-bold leading-tight tracking-[0.005em] text-white transition-colors hover:text-cyan"
          >
            {item.name}
          </Link>
        ) : (
          <span className="font-display text-[17px] font-bold leading-tight tracking-[0.005em] text-white">
            {item.name}
          </span>
        )}

        {variations.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] tracking-[0.06em] text-white/55">
            {variations.map((v, i) => (
              <span key={v.label}>
                {i > 0 && <span className="mx-1 text-white/30">·</span>}
                {v.label}: <b className="font-medium text-cyan">{v.value}</b>
              </span>
            ))}
          </div>
        )}

        {productionDays != null && productionDays > 0 && !isQuote && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan/55 bg-cyan/[0.06] px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-cyan">
            <Clock className="size-2.5" />
            Sản xuất: {productionDays} ngày
          </span>
        )}

        {isOutOfStock && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-red-500/40 bg-red-500/20 px-2 py-0.5 font-display tracking-[0.12em] text-red-200">
              HẾT HÀNG
            </span>
            {revalidated?.availableStock != null &&
              revalidated.availableStock > 0 && (
                <span className="text-red-200/70">
                  Còn {revalidated.availableStock}
                </span>
              )}
          </div>
        )}
        {priceChanged && !isOutOfStock && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-200">
            <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5">
              Giá đã cập nhật
            </span>
            <span className="text-amber-200/70">
              Trước đây {formatCurrency(item.price)}, bây giờ{" "}
              {formatCurrency(currentPrice)}
            </span>
          </div>
        )}

        {item.bundleChildren && item.bundleChildren.length > 0 && (
          <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
            {item.bundleChildren.map((child, ci) => (
              <div
                key={ci}
                className="flex items-center gap-3 text-[11px] text-white/55"
              >
                {child.image ? (
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-md border border-white/10">
                    <Image
                      src={child.image}
                      alt={child.name}
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="size-9 shrink-0 rounded-md bg-white/[0.04]" />
                )}
                <span className="flex-1 truncate text-white/80">
                  {child.name}
                </span>
                <span className="font-mono">
                  ×{child.quantity * item.quantity}
                </span>
                <span className="font-mono text-cyan">
                  {formatCurrency(
                    child.discountedPrice * child.quantity * item.quantity,
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:min-w-[140px] sm:flex-col sm:items-end sm:justify-start sm:gap-4">
        <div className="text-right">
          <div className="font-display text-[22px] font-extrabold leading-none text-white">
            {formatCurrency(lineTotal)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-white/55">
            {formatCurrency(currentPrice)} / cái
          </div>
        </div>

        <div className="flex items-center overflow-hidden rounded-full border border-white/10">
          <button
            type="button"
            onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
            disabled={isQuote || item.quantity <= 1}
            aria-label="Giảm số lượng"
            className="grid h-9 w-8 place-items-center text-white transition hover:bg-cyan/[0.08] hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="size-3.5" />
          </button>
          <input
            readOnly
            value={item.quantity}
            aria-label="Số lượng"
            className="h-9 w-9 bg-transparent text-center font-display text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            disabled={isQuote}
            aria-label="Tăng số lượng"
            className="grid h-9 w-8 place-items-center text-white transition hover:bg-cyan/[0.08] hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 font-display text-[10px] uppercase tracking-[0.1em] text-white/55 transition hover:text-magenta"
        >
          <Trash2 className="size-2.5" />
          Xóa
        </button>
      </div>
    </article>
  );
}
