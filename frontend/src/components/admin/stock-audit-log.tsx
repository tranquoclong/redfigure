"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDateTimeShort } from "@/lib/constants";

interface AuditEntry {
  id: string;
  productId: string;
  variationId?: string;
  variation?: { name: string } | null;
  quantityBefore: number;
  quantityAfter: number;
  delta: number;
  reservedBefore?: number;
  reservedAfter?: number;
  reason: string;
  referenceId?: string;
  createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
  ORDER_RESERVED: "Đơn hàng đã tạo (đã giữ chỗ)",
  ORDER_CONFIRMED: "Thanh toán đã xác nhận",
  ORDER_CANCELLED: "Đơn hàng đã hủy",
  PAYMENT_FAILED: "Thanh toán thất bại",
  ADMIN_ADJUSTMENT: "Điều chỉnh thủ công",
};

export function StockAuditLog({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["stock-log", productId],
    queryFn: async () => {
      const { data } = await api.get(`/stock/${productId}/log`);
      return (data.data ?? data) as AuditEntry[];
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải lịch sử...</p>;
  }

  const logs = data ?? [];

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Chưa có lịch sử chuyển kho hàng.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        {logs.length} lịch sử (tối đa 30)
      </p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Thời gian</th>
              <th className="text-left p-2 font-medium">Đặc điểm</th>
              <th className="text-left p-2 font-medium">Lý do</th>
              <th className="text-right p-2 font-medium">Trước</th>
              <th className="text-center p-2 font-medium">Thay đổi</th>
              <th className="text-right p-2 font-medium">Sau</th>
              <th className="text-left p-2 font-medium">Tham chiếu</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="p-2 text-muted-foreground whitespace-nowrap">
                  {formatDateTimeShort(log.createdAt)}
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {log.variation?.name ??
                    (log.variationId
                      ? log.variationId.slice(0, 8)
                      : "Sản phẩm")}
                </td>
                <td className="p-2">
                  {REASON_LABELS[log.reason] ?? log.reason}
                </td>
                <td className="p-2 text-right font-mono">
                  {log.quantityBefore}
                </td>
                <td className="p-2 text-center">
                  <span
                    className={`inline-flex items-center gap-0.5 font-mono font-medium ${
                      log.delta > 0
                        ? "text-green-600"
                        : log.delta < 0
                          ? "text-red-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    {log.delta > 0 ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : log.delta < 0 ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {log.delta > 0
                      ? `+${log.delta}`
                      : log.delta === 0
                        ? "Lưu trữ"
                        : log.delta}
                  </span>
                </td>
                <td className="p-2 text-right font-mono">
                  {log.quantityAfter}
                </td>
                <td className="p-2 text-muted-foreground text-xs truncate max-w-[120px]">
                  {log.referenceId?.slice(0, 12) ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
