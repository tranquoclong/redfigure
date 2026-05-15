"use client";

import { cn } from "@/lib/utils";

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Đang chờ xử lý",
  CONFIRMED: "Đã xác nhận",
  PROCESSING: "Đang sản xuất",
  SHIPPED: "Đang giao hàng",
  DELIVERED: "Đã giao hàng",
  CANCELLED: "Đã hủy",
  RETURNED: "Đã hoàn trả",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  CONFIRMED: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  PROCESSING: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  SHIPPED: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  DELIVERED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  CANCELLED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  RETURNED: "bg-orange-500/20 text-orange-300 border-orange-500/40",
};

interface OrderStatusPillsProps {
  current: string;
  onSelect: (status: OrderStatus) => void;
  disabled?: boolean;
}

export function OrderStatusPills({
  current,
  onSelect,
  disabled,
}: OrderStatusPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER_STATUSES.map((status) => {
        const isCurrent = current === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled || isCurrent}
            onClick={() => onSelect(status)}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all",
              STATUS_COLOR[status],
              isCurrent
                ? "ring-2 ring-offset-2 ring-offset-background ring-white/40 cursor-default"
                : "opacity-60 hover:opacity-100 hover:scale-105 cursor-pointer",
              disabled && !isCurrent && "cursor-not-allowed opacity-30",
            )}
            title={
              isCurrent
                ? `Trạng thái hiện tại: ${STATUS_LABEL[status]}`
                : `Chuyển sang ${STATUS_LABEL[status]}`
            }
          >
            {STATUS_LABEL[status]}
            {isCurrent && <span className="ml-1.5 text-[10px]">●</span>}
          </button>
        );
      })}
    </div>
  );
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as OrderStatus] ?? status;
}
