"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";

interface ShippingQuote {
  serviceId: number;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
}

interface FreeShippingInfo {
  eligible: boolean;
  minOrderValue: number;
  remaining: number;
}

export interface PdpShippingEstimateProps {
  productId: string;

  variationId?: string | null;

  quantity: number;
}

export function PdpShippingEstimate({
  productId,
  variationId,
  quantity,
}: PdpShippingEstimateProps) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [freeShipping, setFreeShipping] = useState<FreeShippingInfo | null>(
    null,
  );
  const [hasSearched, setHasSearched] = useState(false);

  const handleCepChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const masked =
      digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setCep(masked);
  };

  const handleCalculate = async () => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      setError("ZIP không hợp lệ");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/shipping/quote", {
        zipCode: cleaned,
        products: [
          {
            productId,
            variationId: variationId ?? undefined,
            quantity,
          },
        ],
      });
      const result = data.data;
      setQuotes(result.quotes ?? []);
      setFreeShipping(result.freeShippingInfo ?? null);
      setHasSearched(true);
    } catch {
      setError("Đã có lỗi xảy ra. Vui lòng kiểm tra lại mã ZIP.");
      setQuotes([]);
      setFreeShipping(null);
    } finally {
      setLoading(false);
    }
  };

  const sortedQuotes = [...quotes]
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <span className="text-cyan" aria-hidden>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7" />
          </svg>
        </span>
        <label
          htmlFor="cep-pdp"
          className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-white"
        >
          Vận chuyển
        </label>
        <input
          id="cep-pdp"
          type="text"
          inputMode="numeric"
          placeholder="Nhập mã ZIP của bạn"
          maxLength={9}
          value={cep}
          onChange={(e) => handleCepChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCalculate();
          }}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={handleCalculate}
          disabled={loading || cep.replace(/\D/g, "").length !== 8}
          className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan transition hover:text-white disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Tính toán"
          )}
        </button>
      </div>

      {error && (
        <div className="border-t border-white/10 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-magenta">
          {error}
        </div>
      )}
      {hasSearched && !error && (
        <div className="border-t border-white/10 px-3.5 py-3">
          {freeShipping?.eligible && (
            <div className="mb-2 flex items-baseline justify-between gap-3 font-mono text-[11px]">
              <span className="text-lime">Miễn phí vận chuyển</span>
            </div>
          )}
          {freeShipping &&
            !freeShipping.eligible &&
            freeShipping.remaining > 0 && (
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-cyan/85">
                Còn {formatCurrency(freeShipping.remaining)} nữa để được miễn
                phí vận chuyển
              </div>
            )}
          {sortedQuotes.length === 0 && !freeShipping?.eligible ? (
            <div className="font-mono text-[11px] text-white/55">
              Không có tùy chọn vận chuyển cho mã ZIP được cung cấp.
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sortedQuotes.map((q) => (
                <li
                  key={q.serviceId}
                  className="flex items-baseline justify-between gap-3 text-[12px]"
                >
                  <span className="text-white/80">
                    {q.company} <span className="text-white/40">·</span>{" "}
                    <span className="text-white/55">{q.name}</span>
                  </span>
                  <span className="flex items-baseline gap-2 font-mono text-[11px] text-white/60">
                    <span>
                      {q.deliveryDays} dia{q.deliveryDays === 1 ? "" : "s"}
                    </span>
                    <span className="text-cyan">{formatCurrency(q.price)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
