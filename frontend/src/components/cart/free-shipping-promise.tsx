"use client";

import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/constants";

export interface FreeShippingPromiseProps {
  subtotal: number;
  minOrderValue: number;
  remaining: number;
  eligible: boolean;
}

export function FreeShippingPromise({
  subtotal,
  minOrderValue,
  remaining,
  eligible,
}: FreeShippingPromiseProps) {
  if (minOrderValue <= 0) return null;

  const pct = Math.min(100, Math.round((subtotal / minOrderValue) * 100));

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-[22px] transition-all duration-[var(--dur-base)]",
      )}
      style={{
        background: eligible
          ? "linear-gradient(180deg, rgba(74,222,128,.18), rgba(74,222,128,.04))"
          : "linear-gradient(180deg, rgba(74,222,128,.06), rgba(74,222,128,.01))",
        border: "1px solid",
        borderColor: eligible ? "var(--lime)" : "rgba(74,222,128,.35)",
        boxShadow: eligible ? "0 0 24px rgba(74,222,128,.2)" : "none",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-10 size-[140px] rounded-full bg-lime opacity-10 [filter:blur(40px)]"
      />

      <div className="relative mb-[14px] flex items-center gap-2.5">
        <Truck className="size-5 text-white" aria-hidden />
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-white">
          Miễn phí vận chuyển
        </span>
        <span className="ml-auto font-mono text-xs tracking-[0.06em] text-white/65">
          {pct}%
        </span>
      </div>

      <div className="relative mb-[14px] h-2 overflow-hidden rounded bg-white/[0.06]">
        <div
          className="relative h-full rounded transition-[width] duration-[600ms] [transition-timing-function:var(--ease-out)]"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--lime), #22c55e)",
            boxShadow: "0 0 12px rgba(74,222,128,.6)",
          }}
        >
          {pct > 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-shimmer-slide bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
          )}
        </div>
      </div>

      <p className="relative text-sm leading-snug text-white">
        {eligible ? (
          <>
            🎉{" "}
            <b className="font-bold text-white">
              Bạn đã được MIỄN PHÍ VẬN CHUYỂN!
            </b>
            <span className="mt-1 block font-mono text-[11px] tracking-[0.06em] text-white/55">
              Chọn dưới đây để sử dụng phần thưởng.
            </span>
          </>
        ) : (
          <>
            Thêm{" "}
            <b className="font-bold text-white">{formatCurrency(remaining)}</b>{" "}
            vào đơn hàng và nhận{" "}
            <b className="font-bold text-white">MIỄN PHÍ VẬN CHUYỂN</b>.
            <span className="mt-1 block font-mono text-[11px] tracking-[0.06em] text-white/55">
              Có sẵn cho đơn hàng trên {formatCurrency(minOrderValue)}.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
