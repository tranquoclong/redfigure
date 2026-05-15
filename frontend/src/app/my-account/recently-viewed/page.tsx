"use client";

import { ProductCard } from "@/components/product/product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";

export default function RecentlyViewedPage() {
  const { data: products, isLoading } = useRecentlyViewed();

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải...</p>;
  }

  const items = products ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Đã xem gần đây</h1>

      {items.length === 0 ? (
        <EmptyState
          title="Không có sản phẩm đã xem"
          description="Các sản phẩm bạn xem sẽ xuất hiện ở đây."
        />
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
