"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  CreditCard,
  QrCode,
  Truck,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PaymentData {
  id: string;
  orderId: string;
  method: string;
  gateway?: string;
  status: string;
  amount: number;
  discount: number;
  redirectUrl?: string;
  qr?: string;
  message?: string;
  expiresAt?: string;
  paidAt?: string;
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [order, setOrder] = useState<{
    status: string;
    total: number;
    paymentMethod?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [needsPayment, setNeedsPayment] = useState(false);
  const [copied, setCopied] = useState(false);
  const fetchedRef = useRef(false);

  const fetchPayment = useCallback(async () => {
    try {
      const [{ data: paymentRes }, { data: orderRes }] = await Promise.all([
        api
          .get(`/payments/${orderId}/status`)
          .catch(() => ({ data: { data: null } })),
        api.get(`/orders/${orderId}`).catch(() => ({ data: { data: null } })),
      ]);
      const p = paymentRes.data;
      const o = orderRes.data;

      setOrder(o);

      if (o?.status === "CANCELLED") {
        setError("Đơn hàng này đã bị hủy hoặc đã hết hạn.");
        return;
      }

      if (
        o?.status === "DELIVERED" ||
        o?.status === "SHIPPED" ||
        o?.status === "CONFIRMED"
      ) {
        // If order is already confirmed or further, it might be paid or COD
        if (o?.paymentStatus === "APPROVED") {
          router.replace(`/order/confirmation/${orderId}`);
          return;
        }
      }

      if (!p || p.status === "FAILED" || p.status === "CANCELLED") {
        setNeedsPayment(true);
        setPayment(null);
        return;
      }

      if (p.status === "APPROVED") {
        router.replace(`/order/confirmation/${orderId}`);
        return;
      }

      setPayment(p);
      setNeedsPayment(false);
    } catch {
      setError("Không thể tải thông tin thanh toán.");
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchPayment();
  }, [fetchPayment]);

  // Polling for status update if it's a bank transfer
  useEffect(() => {
    if (payment?.method === "bank_transfer" && payment.status === "PENDING") {
      const interval = setInterval(async () => {
        try {
          const { data: res } = await api.get(`/payments/${orderId}/status`);
          if (res.data?.status === "APPROVED") {
            router.replace(`/order/confirmation/${orderId}`);
          }
        } catch {}
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [payment, orderId, router]);

  async function handleRetryPayment(method: string) {
    setRetrying(true);
    setError("");
    try {
      const { data: paymentData } = await api.post("/payments/create", {
        orderId,
        method,
      });

      const p = paymentData.data;

      if (p?.redirectUrl) {
        window.location.href = p.redirectUrl;
        return;
      }

      if (p?.status === "APPROVED") {
        router.replace(`/order/confirmation/${orderId}`);
        return;
      }

      setPayment(p);
      setNeedsPayment(false);
    } catch (err) {
      const resp = (
        err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      setError(
        resp?.error?.message ?? resp?.message ?? "Lỗi khi tạo thanh toán",
      );
    } finally {
      setRetrying(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan" />
        <p className="text-white/50 font-mono text-xs uppercase tracking-widest">
          Đang tải thông tin...
        </p>
      </div>
    );
  }

  if (error && !needsPayment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-magenta mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2 font-display">Lỗi</h2>
        <p className="text-white/60 mb-8">{error}</p>
        <Button
          onClick={() => router.push("/")}
          variant="outline"
          className="rounded-full"
        >
          Quay lại trang chủ
        </Button>
      </div>
    );
  }

  if (needsPayment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-8 shadow-2xl">
          <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-2">
            Thanh toán đang chờ
          </h1>
          <p className="text-white/80 text-lg font-medium mb-8">
            {order?.total
              ? `Tổng: ${formatCurrency(order.total)}`
              : "Chọn phương thức thanh toán"}
          </p>

          {error && (
            <div className="bg-magenta/10 border border-magenta/20 rounded-2xl px-4 py-3 mb-6 text-sm text-magenta">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={() => handleRetryPayment("bank_transfer")}
              disabled={retrying}
              className="w-full flex items-center gap-4 rounded-2xl border border-cyan/20 bg-cyan/5 p-5 text-left hover:bg-cyan/10 transition-all group disabled:opacity-50"
            >
              <div className="h-12 w-12 rounded-xl bg-cyan/10 flex items-center justify-center text-cyan group-hover:scale-110 transition-transform">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white uppercase tracking-wider">
                  Chuyển khoản
                </p>
                <p className="text-xs text-white/40">Quét mã QR</p>
              </div>
            </button>

            <button
              onClick={() => handleRetryPayment("cod")}
              disabled={retrying}
              className="w-full flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10 transition-all group disabled:opacity-50"
            >
              <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center text-white/60 group-hover:scale-110 transition-transform">
                <Truck className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white uppercase tracking-wider">
                  COD
                </p>
                <p className="text-xs text-white/40">
                  Thanh toán khi nhận hàng
                </p>
              </div>
            </button>
          </div>

          {retrying && (
            <div className="flex items-center justify-center gap-3 mt-8 text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang khởi tạo...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-8 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan via-purple to-magenta" />

        <div className="mb-8">
          <h1 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-1">
            Chi tiết thanh toán
          </h1>
          <p className="text-white/90 text-xl font-bold font-display">
            {formatCurrency(payment?.amount || 0)}
          </p>
        </div>

        {payment?.method === "bank_transfer" && (
          <div className="flex flex-col items-center">
            <div className="relative p-4 bg-white rounded-3xl mb-8 group">
              {payment.qr ? (
                <img
                  src={payment.qr}
                  alt="QR Code"
                  className="w-64 h-64 sm:w-72 sm:h-72"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-black/5">
                  <Loader2 className="h-8 w-8 animate-spin text-black/20" />
                </div>
              )}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">
                SePay Secure
              </div>
            </div>

            <div className="w-full space-y-4">
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">
                    Nội dung chuyển khoản
                  </span>
                  <button
                    onClick={() => copyToClipboard(`DH${payment.id}`)}
                    className="text-cyan hover:text-cyan/80 transition-colors"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-lg font-mono font-bold text-white">
                  DH{payment.id}
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-lime/5 border border-lime/20">
                <CheckCircle2 className="h-5 w-5 text-lime shrink-0 mt-0.5" />
                <p className="text-xs text-white/60 leading-relaxed">
                  Hệ thống sẽ tự động xác nhận sau 1-3 phút kể từ khi nhận được
                  tiền. Bạn không cần làm gì thêm.
                </p>
              </div>
            </div>
          </div>
        )}

        {payment?.method === "cod" && (
          <div className="py-8 text-center">
            <div className="h-20 w-20 rounded-full bg-cyan/10 flex items-center justify-center text-cyan mx-auto mb-6 shadow-[0_0_30px_-10px_rgba(0,240,255,0.3)]">
              <Truck className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">
              Thanh toán khi nhận hàng
            </h2>
            <p className="text-white/50 text-sm leading-relaxed mb-8">
              {payment.message ||
                "Đơn hàng của bạn đã được ghi nhận. Vui lòng chuẩn bị sẵn tiền mặt khi shipper giao hàng đến."}
            </p>
            <Button
              onClick={() => router.push(ROUTES.orders)}
              className="w-full rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 py-6"
            >
              Xem danh sách đơn hàng
            </Button>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-white/30">
              Mã đơn hàng
            </span>
            <span className="text-xs font-mono text-white/60">
              {orderId.slice(0, 8)}...
            </span>
          </div>
          <Button
            variant="ghost"
            className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
            onClick={() => setNeedsPayment(true)}
          >
            Đổi phương thức
          </Button>
        </div>
      </div>
    </div>
  );
}
