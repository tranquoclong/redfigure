"use client";

import { Tag, X } from "lucide-react";

export interface AppliedCoupon {
  code: string;
  couponId: string;
  discount: number;
}

export interface CartCouponProps {
  applied: AppliedCoupon[];

  max: number;

  code: string;
  setCode: (v: string) => void;

  error: string;

  onApply: () => void;

  onRemove: (code: string) => void;
}

export function CartCoupon({
  applied,
  max,
  code,
  setCode,
  error,
  onApply,
  onRemove,
}: CartCouponProps) {
  const reachedMax = applied.length >= max;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.015] p-5">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-white">
        Mã giảm giá
      </h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim() || reachedMax) return;
          onApply();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().trim())}
          placeholder={
            reachedMax ? `Tối đa ${max} mã giảm giá` : "Nhập mã giảm giá"
          }
          disabled={reachedMax}
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 font-mono text-xs text-white outline-none placeholder:text-white/40 transition focus:border-cyan/55 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!code.trim() || reachedMax}
          className="rounded-xl border border-cyan/55 bg-cyan/[0.08] px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan transition hover:bg-cyan/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Áp dụng
        </button>
      </form>

      {error && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-magenta">
          {error}
        </p>
      )}

      {applied.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {applied.map((c) => (
            <li
              key={c.code}
              className="flex items-center justify-between gap-2 rounded-lg border border-cyan/30 bg-cyan/[0.05] px-3 py-2 text-xs"
            >
              <span className="inline-flex items-center gap-1.5 text-cyan">
                <Tag className="size-3" />
                {c.code}
              </span>
              <button
                type="button"
                onClick={() => onRemove(c.code)}
                aria-label={`Xóa mã giảm giá ${c.code}`}
                className="inline-flex items-center gap-1 font-display text-[10px] uppercase tracking-[0.1em] text-white/55 transition hover:text-magenta"
              >
                <X className="size-2.5" />
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
