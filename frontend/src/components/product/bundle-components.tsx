"use client";

import Image from "next/image";
import Link from "next/link";
import { formatCurrency } from "@/lib/constants";
import type { BundleComponent } from "@/types/product";

interface Props {
  components: BundleComponent[];
  discount: number;
}

export function BundleComponents({ components, discount }: Props) {
  if (!components?.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Bộ sưu tập bao gồm
      </h3>
      <div className="space-y-2">
        {components.map((comp) => {
          const child = comp.childProduct;
          const variation = comp.childVariation;
          const price = variation
            ? (variation.salePrice ?? variation.price)
            : (child.salePrice ?? child.basePrice);
          const image =
            variation?.image ??
            child.images?.[0]?.mediaFile?.thumb ??
            child.images?.[0]?.mediaFile?.card;

          return (
            <Link
              key={comp.id}
              href={`/p/${child.slug}`}
              className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/50 transition-colors"
            >
              {image && (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image
                    src={image}
                    alt={child.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{child.name}</p>
                {variation && (
                  <p className="text-xs text-muted-foreground">
                    {variation.name}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                {comp.quantity > 1 && (
                  <span className="text-xs text-muted-foreground mr-1">
                    {comp.quantity}x
                  </span>
                )}
                <span className="text-sm font-medium">
                  {formatCurrency(price)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {discount > 0 && (
        <p className="text-xs font-medium text-green-600">
          {discount}% giảm giá cho bộ sưu tập
        </p>
      )}
    </div>
  );
}
