"use client";

import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency as formatVND } from "@/lib/constants";

export interface StickyBottomCtaProps {
  show: boolean;
  thumbnail?: string;
  productName: string;

  variantSuffix?: string;
  price: number;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCtaClick?: () => void;
}

export function StickyBottomCta({
  show,
  thumbnail,
  productName,
  variantSuffix,
  price,
  ctaLabel,
  ctaDisabled = false,
  onCtaClick,
}: StickyBottomCtaProps) {
  return (
    <div
      aria-hidden={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 backdrop-blur transition-transform duration-[var(--dur-base)] [transition-timing-function:var(--ease-out)]",
        show ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        {thumbnail && (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-white/10 sm:size-14">
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold uppercase tracking-wide text-white">
            {productName}
          </div>
          {variantSuffix && (
            <div className="truncate font-mono text-[11px] uppercase tracking-wider text-cyan/85">
              {variantSuffix}
            </div>
          )}
        </div>

        <div className="hidden text-right sm:block">
          <div className="font-display text-lg font-bold text-white">
            {formatVND(price)}
          </div>
        </div>

        <Button
          variant={ctaDisabled ? "neon-locked" : "neon"}
          size="pill-lg"
          disabled={ctaDisabled}
          onClick={onCtaClick}
          className="shrink-0"
        >
          <ShoppingCart className="size-4" />
          <span className="hidden sm:inline">{ctaLabel}</span>
          <span className="sm:hidden">{formatVND(price)}</span>
        </Button>
      </div>
    </div>
  );
}
