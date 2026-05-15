"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Reason =
  | "ORDER_RESERVED"
  | "ORDER_CONFIRMED"
  | "ORDER_CANCELLED"
  | "PAYMENT_FAILED"
  | "ADMIN_ADJUSTMENT";

interface AuditLog {
  id: string;
  productId: string;
  variationId: string | null;
  variationName: string | null;
  quantityBefore: number;
  quantityAfter: number;
  delta: number;
  reservedBefore: number | null;
  reservedAfter: number | null;
  reason: Reason;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  reference:
    | { type: "admin"; admin: { name: string; email: string } | null }
    | { type: "order"; orderNumber: string | null; orderId: string }
    | null;
}

interface AuditResponse {
  data: AuditLog[];
  meta: { total: number; page: number; perPage: number; lastPage: number };
}

const REASON_LABEL: Record<Reason, string> = {
  ORDER_RESERVED: "Đã đặt đơn",
  ORDER_CONFIRMED: "Đã xác nhận đơn hàng",
  ORDER_CANCELLED: "Đã hủy đơn hàng",
  PAYMENT_FAILED: "Thanh toán thất bại",
  ADMIN_ADJUSTMENT: "Điều chỉnh thủ công",
};

const REASON_VARIANT: Record<
  Reason,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ORDER_RESERVED: "secondary",
  ORDER_CONFIRMED: "default",
  ORDER_CANCELLED: "outline",
  PAYMENT_FAILED: "destructive",
  ADMIN_ADJUSTMENT: "outline",
};

export default function HistoryStockPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const perPage = 50;

  const { data: product } = useQuery({
    queryKey: ["admin", "product-basic", id],
    queryFn: async () => {
      const { data } = await api.get(`/products/${id}`);
      return data.data as { id: string; name: string; sku?: string };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stock-audit", id, page],
    queryFn: async () => {
      const { data } = await api.get(
        `/products/${id}/stock-audit?page=${page}&perPage=${perPage}`,
      );
      return data as AuditResponse;
    },
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="container mx-auto max-w-6xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/products/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Trở lại sản phẩm
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Lịch sử tồn kho</h1>
        {product && (
          <p className="text-sm text-muted-foreground">
            {product.name}
            {product.sku && <span className="ml-2">· SKU {product.sku}</span>}
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{meta?.total ?? 0} ghi nhận</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-6 text-sm text-muted-foreground">Đang tải…</div>
          )}
          {!isLoading && logs.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Không có nhật ký tồn kho nào cho sản phẩm này.
            </div>
          )}
          {!isLoading && logs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Ngày</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Phiên bản
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Lý do</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Trước đó
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Sau đó</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Thay đổi
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      Tham chiếu
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-4 py-2 whitespace-nowrap text-xs">
                        {formatDateTime(l.createdAt)}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {l.variationName ?? (
                          <span className="text-muted-foreground">
                            — (sản phẩm)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={REASON_VARIANT[l.reason]}
                          className="text-[10px]"
                        >
                          {REASON_LABEL[l.reason] ?? l.reason}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {l.quantityBefore}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {l.quantityAfter}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-mono font-semibold ${
                          l.delta > 0
                            ? "text-green-600"
                            : l.delta < 0
                              ? "text-red-600"
                              : ""
                        }`}
                      >
                        {l.delta > 0 ? "+" : ""}
                        {l.delta}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {l.reference?.type === "order" &&
                          l.reference.orderNumber && (
                            <Link
                              href={`/admin/orders/${l.reference.orderId}`}
                              className="text-primary underline"
                            >
                              #{l.reference.orderNumber}
                            </Link>
                          )}
                        {l.reference?.type === "admin" && l.reference.admin && (
                          <span title={l.reference.admin.email}>
                            {l.reference.admin.name || l.reference.admin.email}
                          </span>
                        )}
                        {!l.reference && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {l.note ? (
                          <span>{l.note}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {meta.page} của {meta.lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}
