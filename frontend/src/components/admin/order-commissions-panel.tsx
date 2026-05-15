"use client";

import { useQuery } from "@tanstack/react-query";
import { Handshake, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";

interface Commission {
  id: string;
  orderItemId: string;
  status: "PENDING" | "APPROVED" | "CANCELLED";
  source: "REFERRAL_COOKIE" | "COUPON";
  baseAmount: string;
  rate: string;
  commissionAmount: string;
  approvedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  orderItem: {
    id: string;
    productName: string | null;
    productSku: string | null;
    quantity: number;
    price: number;
  };
  affiliate: {
    id: string;
    publicId: number;
    user: { name: string | null; email: string };
  };
}

interface Response {
  data: Commission[];
  meta: { totalCommission: number };
}

function statusBadge(status: Commission["status"]) {
  if (status === "APPROVED") {
    return (
      <Badge
        className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
        title="Hoa hồng đã được phê duyệt và ghi có vào sao kê"
      >
        A
      </Badge>
    );
  }
  if (status === "CANCELLED") {
    return (
      <Badge
        variant="outline"
        className="border-destructive/40 text-destructive"
        title="Hoa hồng bị hủy (đơn hàng bị hủy trước thời hạn giữ hàng)"
      >
        X
      </Badge>
    );
  }
  return (
    <Badge
      className="bg-amber-500/20 text-amber-400 border-amber-500/40"
      title="Đang chờ xử lý - được phê duyệt 7 ngày sau khi giao hàng"
    >
      P
    </Badge>
  );
}

export function OrderCommissionsPanel({
  orderId,
  orderTotal,
}: {
  orderId: string;
  orderTotal: number;
}) {
  const { data, isLoading } = useQuery<Response>({
    queryKey: ["admin", "order", orderId, "commissions"],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}/commissions`);
      return data;
    },
  });

  if (isLoading) return null;

  const commissions = data?.data ?? [];
  if (commissions.length === 0) return null;

  const totalCommission = data?.meta.totalCommission ?? 0;
  const storeEarnings = orderTotal - totalCommission;

  const firstAff = commissions[0]?.affiliate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Handshake className="h-4 w-4 text-purple" />
          Hoa hồng Affiliate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {firstAff && (
          <div className="flex items-center gap-3 text-sm">
            <div className="flex-1">
              <Link
                href={`/admin/affiliate`}
                className="font-medium text-cyan hover:underline inline-flex items-center gap-1"
              >
                #{firstAff.publicId} {firstAff.user.name ?? "(chưa đặt tên)"}
                <ExternalLink className="h-3 w-3" />
              </Link>
              <p className="text-xs text-muted-foreground">
                {firstAff.user.email}
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {commissions[0].source === "COUPON"
                ? "Qua mã giảm giá"
                : "Qua link"}
            </Badge>
          </div>
        )}

        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Sản phẩm</th>
                <th className="text-right px-3 py-2 w-16">Tỷ lệ</th>
                <th className="text-right px-3 py-2 w-24">Hoa hồng</th>
                <th className="text-center px-3 py-2 w-12">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2">
                    <p className="truncate max-w-[220px]">
                      {c.orderItem.productName ?? c.orderItemId.slice(0, 8)}
                    </p>
                    {c.orderItem.productSku && (
                      <p className="text-xs text-muted-foreground">
                        SKU: {c.orderItem.productSku}
                      </p>
                    )}
                  </td>
                  <td className="text-right px-3 py-2 text-muted-foreground">
                    {parseFloat(c.rate).toFixed(2)}%
                  </td>
                  <td className="text-right px-3 py-2 font-medium">
                    {formatCurrency(parseFloat(c.commissionAmount))}
                  </td>
                  <td className="text-center px-3 py-2">
                    {statusBadge(c.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5 text-sm border-t pt-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tổng đơn hàng:</span>
            <span className="font-medium">{formatCurrency(orderTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hoa hồng:</span>
            <span className="font-medium text-purple">
              {formatCurrency(totalCommission)}
            </span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Lợi nhuận ròng:</span>
            <span className="text-emerald-500">
              {formatCurrency(storeEarnings)}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          <strong>P</strong> = Đang chờ xử lý (được phê duyệt 7 ngày sau khi
          giao hàng). <strong>A</strong> = Đã phê duyệt và ghi có vào sao kê.{" "}
          <strong>X</strong> = Đã hủy.
        </p>
      </CardContent>
    </Card>
  );
}
