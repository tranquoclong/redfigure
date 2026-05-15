"use client";

import Link from "next/link";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { formatCurrency } from "@/lib/constants";

interface Props {
  productSlug: string;
}

export function PreCartActions({ productSlug }: Props) {
  const subtotal = useCartStore((s) => s.subtotal);
  const itemCount = useCartStore((s) => s.items.length);

  return (
    <div className="flex flex-col items-end gap-3 shrink-0">
      {subtotal > 0 && (
        <div className="text-right">
          <p className="text-xs text-white/50">Tổng giỏ hàng</p>
          <p className="[font-family:var(--font-orbitron)] text-xl text-white">
            {formatCurrency(subtotal)}
          </p>
          {itemCount > 0 && (
            <p className="text-xs text-white/40">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </p>
          )}
        </div>
      )}
      <div className="flex gap-3">
        <Link
          href={`/p/${productSlug}`}
          className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/70 hover:border-cyan/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tiếp tục mua sắm
        </Link>
        <Link
          href="/cart"
          className="flex items-center gap-2 rounded-full bg-gradient-to-br from-magenta to-purple px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-white shadow-[0_0_22px_rgba(255,0,122,0.5),0_0_44px_rgba(184,41,255,0.35)] hover:shadow-[0_0_28px_rgba(255,0,122,0.6),0_0_56px_rgba(184,41,255,0.45)] hover:brightness-110 transition-all [font-family:var(--font-orbitron)]"
        >
          <ShoppingBag className="h-4 w-4" />
          Đến giỏ hàng
        </Link>
      </div>
    </div>
  );
}
