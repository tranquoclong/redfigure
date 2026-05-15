"use client";

import Image from "next/image";
import { Gift, Lock } from "lucide-react";
import type { CartItem } from "@/types/cart";

export function FreeGiftCartItem({ item }: { item: CartItem }) {
  return (
    <div className="rounded-lg border border-magenta/30 bg-gradient-to-r from-magenta/5 to-purple-500/5 p-3">
      <div className="flex items-start gap-3">
        {item.image ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-black/20">
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-magenta/10">
            <Gift className="h-6 w-6 text-magenta" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-magenta/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-magenta">
              <Gift className="h-3 w-3" />
              quà tặng
            </span>
          </div>
          <h3 className="mt-1 text-sm font-medium text-white truncate">
            {item.name}
          </h3>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-bold text-magenta">0,00đ</span>
            <button
              type="button"
              disabled
              title="Quà tặng thêm vào tự động - không thể xóa"
              className="inline-flex items-center gap-1 text-xs text-white/30 cursor-not-allowed"
            >
              <Lock className="h-3 w-3" />
              Quà tặng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function partitionCartItems<T extends CartItem>(items: T[]) {
  const normal: T[] = [];
  const gifts: T[] = [];
  for (const it of items) {
    if (it.isFreeGift) gifts.push(it);
    else normal.push(it);
  }
  return { normal, gifts };
}
