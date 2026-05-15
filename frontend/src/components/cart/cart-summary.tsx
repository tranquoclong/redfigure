"use client";

import Link from "next/link";
import { Lock, Shield, ArrowRight } from "lucide-react";
import { ROUTES, formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

export type PaymentMethodId = "sepay" | "credit_card" | "cod";

export interface PaymentMethodSummaryUI {
  id: PaymentMethodId;
  label: string;
  enabled: boolean;
  discount: number;
  maxInstallments?: number;
}

function installmentsHint(max: number | undefined): string | undefined {
  return max && max >= 2 ? `${max}× s/ juros` : undefined;
}

export interface CartSummaryProps {
  itemCount: number;
  subtotal: number;
  shipping: { name: string; price: number } | null;
  couponDiscount: number;
  appliedCouponCodes: string[];

  paymentMethods: PaymentMethodSummaryUI[];

  selectedMethod: PaymentMethodId;
  onSelectMethod: (id: PaymentMethodId) => void;

  hasOutOfStock: boolean;

  shippingMissing: boolean;
}

export function CartSummary({
  itemCount,
  subtotal,
  shipping,
  couponDiscount,
  appliedCouponCodes,
  paymentMethods,
  selectedMethod,
  onSelectMethod,
  hasOutOfStock,
  shippingMissing,
}: CartSummaryProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const checkoutHref = isAuthenticated
    ? ROUTES.checkout
    : ROUTES.checkoutIdentification;
  const shippingPrice = shipping?.price ?? 0;
  const totalRaw = Math.max(0, subtotal + shippingPrice - couponDiscount);
  const selectedDiscount =
    paymentMethods.find((m) => m.id === selectedMethod)?.discount ?? 0;

  const methodDiscountValue =
    Math.round(subtotal * (selectedDiscount / 100) * 100) / 100;
  const totalFinal = Math.max(0, totalRaw - methodDiscountValue);
  const isShippingFree = shipping != null && shippingPrice === 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.015] p-5">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-white">
        Tóm tắt đơn hàng
      </h3>

      <div className="flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-white/65">Tổng ({itemCount} sản phẩm)</span>
          <span className="font-mono text-white">
            {formatCurrency(subtotal)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/65">
            Vận chuyển{shipping ? ` · ${shipping.name}` : ""}
          </span>
          {shipping ? (
            isShippingFree ? (
              <span className="font-display text-[13px] font-bold uppercase tracking-[0.06em] text-lime">
                MIỄN PHÍ
              </span>
            ) : (
              <span className="font-mono text-white">
                {formatCurrency(shippingPrice)}
              </span>
            )
          ) : (
            <span className="font-mono text-xs text-white/40">Tính ở trên</span>
          )}
        </div>

        {couponDiscount > 0 && (
          <div className="flex justify-between text-lime">
            <span>
              {appliedCouponCodes.length === 1
                ? "Mã giảm giá"
                : "Các mã giảm giá"}{" "}
              <span className="font-mono text-[10px] tracking-[0.06em] opacity-80">
                {appliedCouponCodes.join(" + ")}
              </span>
            </span>
            <span className="font-mono">
              − {formatCurrency(couponDiscount)}
            </span>
          </div>
        )}

        {selectedDiscount > 0 && (
          <div className="flex justify-between text-lime">
            <span>
              Giảm giá{" "}
              {paymentMethods.find((m) => m.id === selectedMethod)?.label} (−
              {selectedDiscount}%)
            </span>
            <span className="font-mono">
              − {formatCurrency(methodDiscountValue)}
            </span>
          </div>
        )}

        <hr className="my-1 border-white/10" />

        <div className="flex items-baseline justify-between pt-1">
          <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-white">
            Tổng
          </span>
          <div className="text-right">
            <div className="font-display text-[32px] font-extrabold leading-none tracking-[0.005em] text-white">
              {formatCurrency(totalFinal)}
            </div>
            <div className="mt-1 font-mono text-[11px] tracking-[0.08em] text-cyan">
              Thanh toán qua QR
            </div>
          </div>
        </div>
      </div>

      {paymentMethods.length > 0 && (
        <div
          className={cn(
            "mt-4 grid gap-2",
            paymentMethods.length === 1 && "grid-cols-1",
            paymentMethods.length === 2 && "grid-cols-2",
            paymentMethods.length === 3 && "grid-cols-3",
          )}
        >
          {paymentMethods.map((m) => {
            const isSelected = m.id === selectedMethod;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMethod(m.id)}
                className={cn(
                  "rounded-xl border bg-black/30 px-2 py-3 text-center transition-colors duration-[var(--dur-base)]",
                  isSelected
                    ? "border-cyan bg-cyan/[0.08] [box-shadow:var(--glow-cyan-sm)]"
                    : "border-white/10 hover:border-cyan/45",
                )}
              >
                <div
                  className={cn(
                    "font-display text-xs uppercase tracking-[0.08em]",
                    isSelected ? "text-cyan" : "text-white",
                  )}
                >
                  {m.label}
                </div>
                <div
                  className={cn(
                    "mt-1 font-mono text-[9px] tracking-[0.08em]",
                    m.discount > 0 ? "font-bold text-lime" : "text-cyan/85",
                  )}
                >
                  {m.discount > 0
                    ? `−${m.discount}%`
                    : (installmentsHint(m.maxInstallments) ?? "")}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {hasOutOfStock ? (
        <button
          type="button"
          disabled
          aria-disabled
          title="Xóa sản phẩm hết hàng để tiếp tục"
          className="mt-4 flex h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-full font-display text-sm font-extrabold uppercase tracking-[0.1em] text-white/45 [background:rgba(255,255,255,.04)]"
        >
          Hết hàng
        </button>
      ) : (
        <Link
          href={checkoutHref}
          className={cn(
            "mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-full font-display text-sm font-extrabold uppercase tracking-[0.1em] text-white transition hover:brightness-110 hover:-translate-y-px",
            shippingMissing && "opacity-95",
          )}
          style={{
            background: "var(--grad-cta)",
            boxShadow: "var(--glow-purple)",
          }}
        >
          Thanh toán
          <ArrowRight className="size-[18px]" strokeWidth={2.5} />
        </Link>
      )}
      {hasOutOfStock && (
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-red-200/80">
          Xóa sản phẩm hết hàng
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3.5 font-mono text-[10px] tracking-[0.08em] text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3 text-lime" /> SSL
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Shield className="size-3 text-lime" /> Mua hàng an toàn
        </span>
      </div>
    </div>
  );
}
