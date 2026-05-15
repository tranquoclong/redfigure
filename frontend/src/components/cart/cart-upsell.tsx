"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { ROUTES, formatCurrency } from "@/lib/constants";

export interface CartUpsellProps {
  excludeIds: string[];

  brandIds: string[];
}

interface UpsellProduct {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  salePrice?: number | null;
  displayPrice?: number | null;
  brand?: { name: string } | null;
  images?: Array<{
    mediaFile?: { card?: string; thumb?: string } | null;
    url?: string | null;
  }>;
}

const PER_PAGE = 6;

export function CartUpsell({ excludeIds, brandIds }: CartUpsellProps) {
  const [items, setItems] = useState<UpsellProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (brandIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    Promise.all(
      brandIds.slice(0, 3).map((brandId) =>
        api
          .get("/products", { params: { brandId, perPage: PER_PAGE } })
          .then(
            (r) =>
              (Array.isArray(r.data?.data)
                ? r.data.data
                : []) as UpsellProduct[],
          )
          .catch(() => [] as UpsellProduct[]),
      ),
    )
      .then((batches) => {
        if (cancelled) return;
        const seen = new Set(excludeIds);
        const merged: UpsellProduct[] = [];
        for (const batch of batches) {
          for (const p of batch) {
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            merged.push(p);
            if (merged.length >= 3) break;
          }
          if (merged.length >= 3) break;
        }
        setItems(merged);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brandIds.join("|")]);

  if (loading || items.length === 0) return null;

  return (
    <div className="mt-5 rounded-2xl border border-dashed border-magenta/55 bg-magenta/[0.04] p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <Clock className="size-4 text-magenta" aria-hidden />
        <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white">
          Bạn cũng có thể thích
        </h3>
        <span className="ml-auto font-mono text-[11px] text-magenta">
          ↓ cùng studio
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        {items.map((p) => {
          const price = p.displayPrice ?? p.salePrice ?? p.basePrice;
          const img =
            p.images?.[0]?.mediaFile?.card ??
            p.images?.[0]?.mediaFile?.thumb ??
            p.images?.[0]?.url ??
            "";
          return (
            <Link
              key={p.id}
              href={ROUTES.product(p.slug)}
              className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/30 p-2.5 transition hover:border-cyan/55"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-black">
                {img ? (
                  <Image
                    src={img}
                    alt={p.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="size-full bg-white/[0.04]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium leading-tight text-white">
                  {p.name}
                </div>
                {p.brand && (
                  <div className="mt-0.5 font-mono text-[9px] tracking-[0.08em] text-white/55">
                    {p.brand.name}
                  </div>
                )}
                <div className="mt-1 font-display text-[13px] font-bold text-cyan">
                  {formatCurrency(price)}
                </div>
              </div>
              <span
                aria-hidden
                className="px-2 font-display text-base text-cyan transition group-hover:scale-110"
              >
                <Plus className="size-4" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
