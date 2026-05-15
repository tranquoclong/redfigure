"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Copy, Clock, Loader2, QrCode } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";

interface PixPaymentProps {
  orderId: string;
  expiresAt: string;
  amount: number;
  compact?: boolean;
}

export function SepayPayment({
  orderId,
  expiresAt,
  amount,
  compact,
}: PixPaymentProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string>("PENDING");
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    function tick() {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft("Expirado");
        setExpired(true);
        return;
      }

      const totalSecs = Math.floor(diff / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      setTimeLeft(
        hours > 0
          ? `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
          : `${mins}:${secs.toString().padStart(2, "0")}`,
      );
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const pollStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/payments/${orderId}/status`);
      const payment = data.data;
      if (payment?.status === "APPROVED") {
        setStatus("APPROVED");
        if (!compact) {
          setTimeout(() => router.push(`/order/confirmation/${orderId}`), 1500);
        }
      } else if (
        payment?.status === "FAILED" ||
        payment?.status === "CANCELLED"
      ) {
        setStatus(payment.status);
      }
    } catch {}
  }, [orderId, router, compact]);

  useEffect(() => {
    if (status !== "PENDING" || expired) return;
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [status, expired, pollStatus]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText("");
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = "";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  if (status === "APPROVED") {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-emerald-400 mb-2 [font-family:var(--font-orbitron)]">
          Đã xác nhận thanh toán!
        </h2>
        {!compact && (
          <>
            <p className="text-white/60 text-sm">
              Đang chuyển hướng đến trang xác nhận đơn hàng...
            </p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4 text-purple" />
          </>
        )}
      </div>
    );
  }

  if (expired) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 text-rose-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-rose-400 [font-family:var(--font-orbitron)]">
          Thanh toán đã hết hạn
        </h3>
        <p className="text-white/50 text-sm mt-2">
          Thời gian thanh toán đã hết hạn.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <QrCode className="h-5 w-5 text-cyan" />
          <h2 className="text-lg font-bold text-white [font-family:var(--font-orbitron)]">
            Thanh toán với QR
          </h2>
        </div>
        <p className="text-white/50 text-sm">
          Quét mã QR hoặc sao chép mã để thanh toán
        </p>
      </div>

      <div className="flex justify-center">
        <div className="bg-white p-5 rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.15)]">
          <img src={""} alt="QR Code" className="w-56 h-56 sm:w-64 sm:h-64" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-white/70 uppercase tracking-wider [font-family:var(--font-orbitron)]">
          QR - Sao chép và dán
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={""}
            readOnly
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-mono text-white/80 truncate"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-2.5 text-xs font-medium text-cyan hover:bg-cyan/20 transition-colors"
          >
            {copied ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Đã sao
                chép
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Sao chép
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-white/50 text-sm">Số tiền cần thanh toán</span>
          <span className="font-bold text-white [font-family:var(--font-orbitron)]">
            {formatCurrency(amount)}
          </span>
        </div>
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <span className="text-white/50 text-sm flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Hết hạn sau
          </span>
          <span className="font-mono font-bold text-lg text-cyan">
            {timeLeft || "Tính toán..."}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="flex items-center justify-center gap-2 text-xs text-white/40">
          <Loader2 className="h-3 w-3 animate-spin" />
          Chờ xác nhận thanh toán...
        </div>
      )}
    </div>
  );
}
