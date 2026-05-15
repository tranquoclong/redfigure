"use client";
import type { ApiRecord } from "@/types/api";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/constants";
import { EmptyState } from "@/components/shared/empty-state";
import { Package } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xử lý",
  CONFIRMED: "Đã xác nhận",
  PROCESSING: "Đang sản xuất",
  SHIPPED: "Đã giao hàng",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  RETURNED: "Đã trả hàng",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  CONFIRMED: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  PROCESSING: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  SHIPPED: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  DELIVERED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  CANCELLED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  RETURNED: "bg-orange-500/20 text-orange-300 border-orange-500/40",
};

export default function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data } = await api.get("/orders", { params: { perPage: 50 } });
      return data;
    },
  });

  if (isLoading) {
    return <p className="text-white/50">Đang tải đơn hàng...</p>;
  }

  const orders = data?.data ?? [];

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Không có đơn hàng"
        description="Bạn chưa có đơn hàng nào."
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Đơn hàng của tôi</h1>

      <div className="space-y-3">
        {orders.map((order: ApiRecord) => {
          const label = STATUS_LABEL[order.status] ?? order.status;
          const color =
            STATUS_COLOR[order.status] ?? "border-white/20 text-white/60";
          const firstItem = (order.items as ApiRecord[])?.[0];
          const thumb = firstItem?.productImage as string | undefined;

          return (
            <Link
              key={order.id}
              href={`/my-account/orders/${order.id}`}
              className="flex items-center gap-4 border border-white/10 rounded-xl p-4 hover:border-white/20 hover:bg-white/[0.02] transition-all"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={(firstItem?.productName as string) ?? "Sản phẩm"}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <Package className="h-5 w-5 text-white/20" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm font-mono text-white">
                    #{order.number}
                  </p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${color}`}
                  >
                    {label}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-0.5">
                  {formatDateTime(order.createdAt)}
                  {firstItem?.productName && (
                    <> · {firstItem.productName as string}</>
                  )}
                  {(order.items as ApiRecord[])?.length > 1 && (
                    <> +{(order.items as ApiRecord[]).length - 1}</>
                  )}
                </p>
              </div>

              <span className="font-bold text-sm text-white shrink-0">
                {formatCurrency(order.total)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
