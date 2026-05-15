"use client";
import type { ApiRecord } from "@/types/api";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDateLong } from "@/lib/constants";
import { OrderItemDetails } from "@/components/shared/item-details";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/product/star-rating";
import { SepayPayment } from "@/components/payment/sepay-payment";
import {
  CheckCircle,
  Circle,
  Star,
  Package,
  Truck,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const STATUS_ORDER = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

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
  PENDING: "text-amber-300",
  CONFIRMED: "text-blue-300",
  PROCESSING: "text-purple-300",
  SHIPPED: "text-cyan-300",
  DELIVERED: "text-emerald-300",
  CANCELLED: "text-rose-300",
  RETURNED: "text-orange-300",
};

const STATUS_BADGE_COLOR: Record<string, string> = {
  PENDING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  CONFIRMED: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  PROCESSING: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  SHIPPED: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  DELIVERED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  CANCELLED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  RETURNED: "bg-orange-500/20 text-orange-300 border-orange-500/40",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data;
    },
  });

  const { data: payment } = useQuery({
    queryKey: ["payment-status", id],
    queryFn: async () => {
      const { data } = await api.get(`/payments/${id}/status`);
      return data.data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const p = query.state.data;

      return p?.status === "PENDING" ? 5000 : false;
    },
  });

  if (isLoading) {
    return <p className="text-white/50">Đang tải...</p>;
  }

  if (!data) {
    return <p className="text-white/50">Không tìm thấy đơn hàng.</p>;
  }

  const currentIndex = STATUS_ORDER.indexOf(data.status);
  const isCancelled = data.status === "CANCELLED" || data.status === "RETURNED";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Đơn hàng {data.number}
          </h1>
          <p className="text-sm text-white/50">
            {formatDateLong(data.createdAt)}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider ${STATUS_BADGE_COLOR[data.status] ?? "border-white/20 text-white/60"}`}
        >
          {STATUS_LABEL[data.status] ?? data.status}
        </span>
      </div>

      {!isCancelled && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-white/70 mb-4">Trạng thái</h2>
          <div className="flex items-center gap-1">
            {STATUS_ORDER.map((status, i) => {
              const reached = i <= currentIndex;
              return (
                <div key={status} className="flex items-center gap-1 flex-1">
                  {reached ? (
                    <CheckCircle
                      className={`h-5 w-5 shrink-0 ${STATUS_COLOR[status] ?? "text-white"}`}
                    />
                  ) : (
                    <Circle className="h-5 w-5 text-white/20 shrink-0" />
                  )}
                  <span
                    className={`text-xs ${reached ? `${STATUS_COLOR[status] ?? "text-white"} font-medium` : "text-white/30"}`}
                  >
                    {STATUS_LABEL[status] ?? status}
                  </span>
                  {i < STATUS_ORDER.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 ${i < currentIndex ? "bg-purple" : "bg-white/10"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isCancelled && (
        <div
          className={`mb-6 rounded-xl border p-4 ${data.status === "CANCELLED" ? "border-rose-500/30 bg-rose-500/5" : "border-orange-500/30 bg-orange-500/5"}`}
        >
          <span className={`text-sm font-medium ${STATUS_COLOR[data.status]}`}>
            Đơn hàng {STATUS_LABEL[data.status]?.toLowerCase() ?? data.status}
          </span>
        </div>
      )}

      {data.status === "PENDING" && (
        <div className="mb-6 rounded-xl border border-purple/20 bg-purple/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-purple" />
            <h2 className="text-sm font-medium text-purple">
              Thanh toán chờ xử lý
            </h2>
          </div>
          <p className="text-sm text-white/50 mb-4">
            Thanh toán cho đơn hàng này chưa được xác nhận. Bạn có thể thử lại.
          </p>
          <Link
            href={`/order/payment/${data.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-purple px-5 py-2.5 text-sm font-medium text-white hover:bg-purple/80 transition-colors"
          >
            Thanh toán ngay
          </Link>
        </div>
      )}

      <>
        <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-5 mb-6">
          {/* <SepayPayment
            orderId={id}
            expiresAt={payment.expiresAt!}
            amount={payment.amount}
            compact
          /> */}
        </div>
        <Separator className="my-6 bg-white/10" />
      </>

      {(data.status === "SHIPPED" || data.status === "DELIVERED") &&
        data.trackingCode && (
          <>
            <div className="mb-6 rounded-xl border border-cyan/20 bg-cyan/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-cyan" />
                <h2 className="text-sm font-medium text-cyan">
                  Theo dõi đơn hàng
                </h2>
              </div>
              <p className="text-sm text-white/70 font-mono">
                {data.trackingCode}
              </p>
              {data.trackingUrl ? (
                <a
                  href={data.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-cyan hover:underline"
                >
                  Theo dõi đơn hàng <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <a
                  href={`https://www.linkcorreios.com.br/?id=${data.trackingCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-cyan hover:underline"
                >
                  Theo dõi đơn hàng <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </>
        )}

      <h2 className="text-sm font-medium text-white/70 mb-4">Sản phẩm</h2>
      <div className="space-y-3">
        {data.items?.map((item: ApiRecord) => (
          <div key={item.id} className="flex gap-3 text-sm">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
              {item.productImage ? (
                <Image
                  src={item.productImage as string}
                  alt={(item.productName as string) ?? "Sản phẩm"}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <Package className="h-4 w-4 text-white/20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                {item.product?.slug ? (
                  <Link
                    href={`/p/${item.product.slug}`}
                    className="text-white truncate hover:text-cyan transition-colors"
                  >
                    {item.productName ?? item.product?.name ?? "Sản phẩm"} x
                    {item.quantity}
                  </Link>
                ) : (
                  <span className="text-white truncate">
                    {item.productName ?? item.product?.name ?? "Sản phẩm"} x
                    {item.quantity}
                  </span>
                )}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-medium text-white">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                  {data.status === "DELIVERED" && (
                    <ReviewButton
                      productId={item.productId}
                      productName={item.productName ?? item.product?.name}
                      orderId={data.id}
                    />
                  )}
                </div>
              </div>
              {(item.variationName || item.scaleName) && (
                <OrderItemDetails
                  variationLabel={item.variationLabel}
                  variationName={item.variationName}
                  scaleName={item.scaleName}
                  className="text-xs text-white/40"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <Separator className="my-6 bg-white/10" />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Tổng tiền</span>
          <span className="text-white">{formatCurrency(data.subtotal)}</span>
        </div>
        {data.discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Khuyến mãi coupon</span>
            <span className="text-emerald-400">
              -{formatCurrency(data.discount)}
            </span>
          </div>
        )}
        {data.shipping > 0 ? (
          <div className="flex justify-between text-sm">
            <span className="text-white/50">
              Phí vận chuyển · {data.shippingServiceName ?? ""}
            </span>
            <span className="text-white">{formatCurrency(data.shipping)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-sm">
            <span className="text-white/50">
              Phí vận chuyển · {data.shippingServiceName ?? "Miễn phí"}
            </span>
            <span className="text-emerald-400 text-xs">Miễn phí</span>
          </div>
        )}
        <Separator className="bg-white/10" />
        <div className="flex justify-between font-bold text-lg">
          <span className="text-white">Tổng tiền</span>
          <span className="text-white">
            {formatCurrency(payment?.amount ?? data.total)}
          </span>
        </div>
      </div>

      {data.shippingAddress &&
        (() => {
          const addr =
            typeof data.shippingAddress === "string"
              ? JSON.parse(data.shippingAddress)
              : data.shippingAddress;
          return (
            <>
              <Separator className="my-6 bg-white/10" />
              <h2 className="text-sm font-medium text-white/70 mb-3">
                Địa chỉ giao hàng
              </h2>
              <div className="text-sm text-white/60 space-y-1">
                {addr.recipient && (
                  <p className="text-white font-medium">{addr.recipient}</p>
                )}
                <p>{addr.street}</p>
                <p>
                  {addr.ward} — {addr.district}/{addr.province}
                </p>
                {/* <p>ZIP: {addr.postalCode ?? addr.zipCode}</p> */}
              </div>
            </>
          );
        })()}

      {(data.shippingDeadlineDays || data.estimatedDeliveryDate) && (
        <>
          <div className="mt-3 text-sm text-white/40">
            {data.shippingDeadlineDays && (
              <span>
                Thời gian giao hàng: {data.shippingDeadlineDays} ngày làm việc
              </span>
            )}
            {data.estimatedDeliveryDate && (
              <span>
                {data.shippingDeadlineDays ? " · " : ""}Ngày giao dự kiến:{" "}
                {formatDateLong(data.estimatedDeliveryDate)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ReviewButton({
  productId,
  productName,
  orderId,
}: {
  productId: string;
  productName?: string;
  orderId: string;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit() {
    if (rating === 0) return;
    setSending(true);
    try {
      await api.post("/reviews", {
        productId,
        orderId,
        rating,
        comment: comment || undefined,
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return <span className="text-xs text-white/40">✅ Đã đánh giá</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-7 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs text-white/70 hover:bg-white/10 transition-colors flex items-center gap-1"
      >
        <Star className="h-3 w-3" />
        Đánh giá
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Đánh giá {productName ?? "Sản phẩm"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <StarRating
                rating={rating}
                size={32}
                interactive
                onChange={setRating}
              />
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Hãy cho chúng tôi biết trải nghiệm của bạn..."
              rows={3}
            />
            <p className="text-xs text-white/50">
              Mẹo: Nhấp vào liên kết chúng tôi đã gửi qua email để đánh giá tất
              cả các sản phẩm trong đơn hàng cùng một lúc và nhận coupon của
              bạn.
            </p>
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || sending}
              className="w-full rounded-lg bg-purple px-4 py-2.5 text-sm font-medium text-white hover:bg-purple/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Đang gửi..." : "Đánh giá"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
