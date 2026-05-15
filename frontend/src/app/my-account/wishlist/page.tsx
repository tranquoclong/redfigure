"use client";
import type { ApiRecord } from "@/types/api";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api-client";
import { formatCurrency, ROUTES } from "@/lib/constants";

export default function WishlistPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const { data } = await api.get("/wishlist");
      return data.data;
    },
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/wishlist/${productId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải...</p>;
  }

  const items = data ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Danh sách yêu thích</h1>

      {items.length === 0 ? (
        <EmptyState
          title="Danh sách trống"
          description="Thêm sản phẩm vào danh sách yêu thích."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item: ApiRecord) => (
            <div
              key={item.id}
              className="flex items-center justify-between border rounded-lg p-4"
            >
              <Link
                href={ROUTES.product(item.product?.slug ?? "")}
                className="flex-1 min-w-0"
              >
                <h3 className="font-medium text-sm truncate hover:text-primary transition-colors">
                  {item.product?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(item.product?.basePrice ?? 0)}
                </p>
              </Link>

              <Button
                variant="ghost"
                size="icon"
                className="text-destructive shrink-0"
                onClick={() => removeMutation.mutate(item.productId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
