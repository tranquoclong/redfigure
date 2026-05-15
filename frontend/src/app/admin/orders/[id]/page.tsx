"use client";

import type { ApiRecord } from "@/types/api";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/constants";
import { OrderItemDetails } from "@/components/shared/item-details";
import {
  OrderStatusPills,
  statusLabel,
  type OrderStatus,
} from "@/components/admin/order-status-pills";
import { OrderStatusChangeModal } from "@/components/admin/order-status-change-modal";
import { PaymentEventList } from "@/components/admin/payment-event-list";
import { CheckoutLogList } from "@/components/admin/checkout-log-list";
import { DeleteOrderButton } from "@/components/admin/delete-order-button";
import { OrderCommissionsPanel } from "@/components/admin/order-commissions-panel";
import { useState } from "react";

interface ShippingAddress {
  recipient?: string;
  postalCode?: string;
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
  country?: string;
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin", "order", id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { status: string; reason?: string }) =>
      api.put(`/orders/${id}/status`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "order", id] });
      setPendingStatus(null);
      setReason("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      router.push("/admin/orders");
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải...</p>;
  }

  if (!order) {
    return <p className="text-muted-foreground">Không tìm thấy đơn hàng.</p>;
  }

  const address: ShippingAddress | null = order.shippingAddress ?? null;
  const payment = order.payments?.[0];
  const events = payment?.events ?? [];

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Đơn hàng #{order.number}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ngày {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="text-base px-4 py-1.5">
            {statusLabel(order.status)}
          </Badge>
          <DeleteOrderButton
            status={order.status}
            loading={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate()}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thay đổi trạng thái</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusPills
            current={order.status}
            disabled={updateMutation.isPending}
            onSelect={(status) => setPendingStatus(status)}
          />
          <p className="text-xs text-muted-foreground mt-3">
            Nhấn vào bất kỳ trạng thái nào để di chuyển đơn hàng. Khách hàng sẽ
            nhận được email tự động. Hàng tồn kho được giữ lại/giải phóng tùy
            theo quy trình chuyển đổi.
          </p>
        </CardContent>
      </Card>

      <OrderCommissionsPanel
        orderId={order.id as string}
        orderTotal={(order.total as number) ?? 0}
      />

      <OrderStatusChangeModal
        open={pendingStatus !== null}
        fromStatus={order.status}
        toStatus={pendingStatus}
        loading={updateMutation.isPending}
        reason={reason}
        onReasonChange={setReason}
        onConfirm={() =>
          pendingStatus &&
          updateMutation.mutate({
            status: pendingStatus,
            reason: reason.trim() || undefined,
          })
        }
        onCancel={() => {
          setPendingStatus(null);
          setReason("");
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Tên" value={order.customerName} />
          <Field label="Email" value={order.customerEmail} />
          <Field label="CCCD" value={order.customerCccd} />
          <Field label="Điện thoại" value={order.customerPhone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Địa chỉ giao hàng</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {address ? (
            <div className="space-y-1">
              {address.recipient && (
                <p className="font-medium">{address.recipient}</p>
              )}
              <p>{address.street}</p>
              <p>
                {address.ward}
                {address.ward && address.district && " · "}
                {address.district}
                {address.province && ` / ${address.province}`}
              </p>
              {address.postalCode && (
                <p className="text-muted-foreground">
                  ZIP {address.postalCode}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sản phẩm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.items?.map((item: ApiRecord) => (
            <div key={item.id as string} className="flex gap-4 text-sm">
              {item.productImage ? (
                <img
                  src={item.productImage as string}
                  alt={(item.productName as string) ?? ""}
                  className="h-16 w-16 rounded-md object-cover border border-white/10"
                />
              ) : (
                <div className="h-16 w-16 rounded-md border border-white/10 bg-white/[0.02]" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">
                    {(item.productName as string) ??
                      (item.product as ApiRecord | undefined)?.name ??
                      "Sản phẩm"}
                  </span>
                  <span className="font-medium whitespace-nowrap">
                    {formatCurrency(
                      (item.price as number) * (item.quantity as number),
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                  {item.productSku && (
                    <span>SKU: {item.productSku as string}</span>
                  )}
                  {item.productBrandName && (
                    <span>{item.productBrandName as string}</span>
                  )}
                  {item.productCategoryName && (
                    <span>{item.productCategoryName as string}</span>
                  )}
                  <span>Số lượng: {item.quantity as number}</span>
                </div>
                {(item.variationName || item.scaleName) && (
                  <OrderItemDetails
                    variationLabel={item.variationLabel as string | undefined}
                    variationName={item.variationName as string | undefined}
                    scaleName={item.scaleName as string | undefined}
                    scalePercentage={item.scalePercentage as number | undefined}
                    unitPrice={item.price as number}
                    className="text-xs text-muted-foreground mt-1"
                  />
                )}
              </div>
            </div>
          ))}
          <Separator />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng Cộng</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Giảm giá</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            {order.shipping > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí vận chuyển</span>
                <span>{formatCurrency(order.shipping)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Tổng cộng</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Phí vận chuyển</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Đơn vị vận chuyển" value={order.shippingCarrier} />
          <Field label="Dịch vụ" value={order.shippingServiceName} />
          <Field
            label="Giá phí vận chuyển"
            value={
              order.shipping > 0 ? formatCurrency(order.shipping) : "Miễn phí"
            }
          />
          <Field label="Thời gian (ngày)" value={order.shippingDeadlineDays} />
          <Field label="Mã vận chuyển" value={order.trackingCode} />
          <Field
            label="Ngày dự kiến giao hàng"
            value={
              order.estimatedDeliveryDate
                ? formatDateTime(order.estimatedDeliveryDate)
                : null
            }
          />
        </CardContent>
      </Card>

      {payment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Phương" value={payment.method} />
            <Field label="Status" value={payment.status} />
            <Field label="Giá trị" value={formatCurrency(payment.amount)} />
            <Field
              label="Thanh toán"
              value={
                payment.paidAmount ? formatCurrency(payment.paidAmount) : "—"
              }
            />
            <Field
              label="Thanh toán lúc"
              value={payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
            />
            <Field label="Trả" value={payment.installments} />
            <Field
              label="Thẻ"
              value={
                payment.cardLastFour ? `**** ${payment.cardLastFour}` : null
              }
            />
            <Field
              label="Hết hạn"
              value={
                payment.expiresAt ? formatDateTime(payment.expiresAt) : "—"
              }
            />
            <Field label="ID bên ngoài (MP)" value={payment.externalId} />
          </CardContent>
        </Card>
      )}

      {payment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lịch sử thanh toán</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentEventList events={events} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Chi tiết thanh toán</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Timeline hoàn chỉnh của tất cả những gì đã xảy ra trong đơn hàng này
            — giá cả, tồn kho, tạo, thanh toán, webhooks, email. Sử dụng để điều
            tra bất kỳ sự sai lệch nào (khách hàng nói đã thanh toán, tổng sai,
            v.v.). Lưu trữ trong 30 ngày.
          </p>
          <CheckoutLogList orderId={order.id as string} />
        </CardContent>
      </Card>

      {order.statusHistory?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Lịch sử thay đổi trạng thái
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.statusHistory.map((entry: ApiRecord, i: number) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {entry.fromStatus
                        ? `${statusLabel(entry.fromStatus as string)} → ${statusLabel(
                            entry.toStatus as string,
                          )}`
                        : statusLabel(entry.toStatus as string)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt as string)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-0.5">
        {value !== null && value !== undefined && value !== "" ? value : "—"}
      </p>
    </div>
  );
}
