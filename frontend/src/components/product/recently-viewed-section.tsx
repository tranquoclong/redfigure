"use client";

import { usePathname } from "next/navigation";
import { ProductCard } from "./product-card";
import { PdpSectionHeader } from "./pdp-section-header";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";

const HIDE_ON_PATHS = ["/checkout", "/order"];

export function RecentlyViewedSection() {
  const pathname = usePathname();
  const { data: products, isLoading } = useRecentlyViewed();

  if (
    pathname &&
    HIDE_ON_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return null;
  }

  if (isLoading || !products || products.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1400px] z-auto px-4 py-10 sm:px-6 lg:px-8">
      <PdpSectionHeader
        num="05"
        eyebrow="Lịch sử"
        title="Sản phẩm đã xem gần đây"
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={i} product={p} />
        ))}
      </div>
    </section>
  );
}
