"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface ShippingQuote {
  serviceId: number;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
  deliveryRange: { min: number; max: number };
  deliveryDate?: string;
  deliveryDateFormatted?: string;
}

export interface FreeShippingInfo {
  eligible: boolean;
  minOrderValue: number;
  remaining: number;

  extraDays: number;

  businessDays?: number | null;
  deliveryDateFormatted?: string;
}

const FREE_SHIPPING_SERVICE_ID = -1;

function shortenDate(formatted: string | null | undefined): string {
  if (!formatted) return "";
  const match = formatted.match(/^(\d{2}\/\d{2})\/\d{4}$/);
  return match ? match[1] : formatted;
}

interface ShippingCalculatorProps {
  products: Array<{
    productId?: string;
    variationId?: string;
    quoteItemId?: string;
    quantity: number;
  }>;
  selectedQuote?: ShippingQuote | null;
  onSelectQuote: (quote: ShippingQuote) => void;
  onCepChange?: (cep: string) => void;

  onFreeShippingInfo?: (info: FreeShippingInfo | null) => void;
  initialCep?: string;
  externalCep?: string;
}

export function ShippingCalculator({
  products,
  selectedQuote,
  onSelectQuote,
  onCepChange,
  onFreeShippingInfo,
  initialCep = "",
  externalCep,
}: ShippingCalculatorProps) {
  const [cep, setCep] = useState(initialCep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [freeShippingInfo, setFreeShippingInfo] =
    useState<FreeShippingInfo | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const lastCalculatedCep = useRef("");
  const lastProductsKey = useRef("");

  const effectiveCep = externalCep ?? cep;

  const productsKey = JSON.stringify(
    products.map((p) => `${p.productId}:${p.variationId ?? ""}:${p.quantity}`),
  );

  async function handleCalculate(cepValue?: string) {
    const cleaned = (cepValue ?? effectiveCep).replace(/\D/g, "");
    if (cleaned.length !== 8) {
      setError("Mã bưu chính phải có 8 chữ số.");
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);
    lastCalculatedCep.current = cleaned;
    lastProductsKey.current = productsKey;

    try {
      const { data } = await api.post("/shipping/quote", {
        zipCode: cleaned,
        products,
      });

      const result = data.data;
      setQuotes(result.quotes);
      setFreeShippingInfo(result.freeShippingInfo ?? null);
      onFreeShippingInfo?.(result.freeShippingInfo ?? null);
      onCepChange?.(cleaned);

      const isFreeEligible = result.freeShippingInfo?.eligible;

      if (result.quotes.length > 0) {
        const existingId = selectedQuote?.serviceId;
        const existingMatch =
          existingId !== undefined && existingId !== FREE_SHIPPING_SERVICE_ID
            ? result.quotes.find(
                (q: ShippingQuote) => q.serviceId === existingId,
              )
            : null;
        const existingStillValid =
          existingId === FREE_SHIPPING_SERVICE_ID
            ? isFreeEligible
            : !!existingMatch;

        if (!existingStillValid) {
          if (isFreeEligible) {
            const cheapest = result.quotes.reduce(
              (min: ShippingQuote, q: ShippingQuote) =>
                q.price < min.price ? q : min,
              result.quotes[0],
            );
            onSelectQuote({
              serviceId: FREE_SHIPPING_SERVICE_ID,
              name: "Miễn phí vận chuyển",
              company: cheapest.company,
              price: 0,
              deliveryDays: cheapest.deliveryDays,
              deliveryRange: cheapest.deliveryRange,
              deliveryDateFormatted:
                result.freeShippingInfo?.deliveryDateFormatted,
            });
          } else {
            const cheapest = result.quotes.reduce(
              (min: ShippingQuote, q: ShippingQuote) =>
                q.price < min.price ? q : min,
              result.quotes[0],
            );
            onSelectQuote(cheapest);
          }
        } else if (existingMatch) {
          if (
            existingMatch.price !== selectedQuote?.price ||
            existingMatch.deliveryDateFormatted !==
              selectedQuote?.deliveryDateFormatted
          ) {
            onSelectQuote(existingMatch);
          }
        }
      }
    } catch {
      setError("Lỗi tính cước. Vui lòng kiểm tra mã bưu chính.");
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!externalCep) return;
    const cleaned = externalCep.replace(/\D/g, "");
    if (cleaned.length === 8 && cleaned !== lastCalculatedCep.current) {
      handleCalculate(cleaned);
    }
  }, [externalCep]);

  useEffect(() => {
    if (externalCep) return;
    const cleaned = initialCep.replace(/\D/g, "");
    if (cleaned.length === 8 && cleaned !== lastCalculatedCep.current) {
      const formatted =
        cleaned.length > 5
          ? `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`
          : cleaned;
      setCep(formatted);
      handleCalculate(cleaned);
    }
  }, [initialCep]);

  useEffect(() => {
    if (!hasSearched) return;
    if (productsKey === lastProductsKey.current) return;
    const cleaned = lastCalculatedCep.current;
    if (cleaned.length === 8) {
      handleCalculate(cleaned);
    }
  }, [productsKey]);

  function handleCepInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const formatted =
      digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setCep(formatted);
    if (digits.length === 8) {
      handleCalculate(digits);
    }
  }

  const sortedQuotes = [...quotes].sort((a, b) => a.price - b.price);

  const isFreeSelected = selectedQuote?.serviceId === FREE_SHIPPING_SERVICE_ID;

  return (
    <div className="flex flex-col gap-3">
      {!externalCep && (
        <div className="flex items-stretch gap-2 rounded-xl border border-white/10 bg-black/30 px-3.5 py-3">
          <span className="grid place-items-center text-cyan" aria-hidden>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <span className="self-center font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-white/65">
            Mã bưu chính
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => handleCepInput(e.target.value)}
            maxLength={9}
            className="min-w-[60px] flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            type="button"
            onClick={() => handleCalculate()}
            disabled={loading || cep.replace(/\D/g, "").length !== 8}
            className="self-center font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan transition hover:text-white disabled:opacity-40"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Tính"}
          </button>
        </div>
      )}

      {error && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-magenta">
          {error}
        </p>
      )}

      {hasSearched && sortedQuotes.length > 0 && (
        <div className="flex flex-col gap-2">
          {freeShippingInfo &&
            (freeShippingInfo.eligible ? (
              <ShipOption
                state="unlocked"
                selected={isFreeSelected}
                onClick={() => {
                  const cheapest = sortedQuotes[0];
                  onSelectQuote({
                    serviceId: FREE_SHIPPING_SERVICE_ID,
                    name: "Miễn phí vận chuyển",
                    company: cheapest?.company ?? "",
                    price: 0,
                    deliveryDays: cheapest?.deliveryDays ?? 0,
                    deliveryRange: cheapest?.deliveryRange ?? {
                      min: 0,
                      max: 0,
                    },
                    deliveryDateFormatted:
                      freeShippingInfo.deliveryDateFormatted,
                  });
                }}
                name="Miễn phí vận chuyển"
                rewardPill="Phần thưởng"
                eta={
                  freeShippingInfo.deliveryDateFormatted ? (
                    <>
                      Giao hàng tối đa{" "}
                      <b className="font-medium text-white">
                        {shortenDate(freeShippingInfo.deliveryDateFormatted)}
                      </b>
                      {freeShippingInfo.businessDays
                        ? ` · ${freeShippingInfo.businessDays} ${
                            freeShippingInfo.businessDays === 1
                              ? "ngày làm việc"
                              : "ngày làm việc"
                          }`
                        : null}
                    </>
                  ) : (
                    "Thời gian giao hàng được tính sau khi xác nhận"
                  )
                }
                priceLabel="MIỄN PHÍ"
              />
            ) : (
              <ShipOption
                state="locked"
                selected={false}
                onClick={() => {}}
                name="Miễn phí vận chuyển"
                rewardPill="Phần thưởng"
                eta={
                  <>
                    Thiếu{" "}
                    <b className="font-medium">
                      {formatCurrency(freeShippingInfo.remaining)}
                    </b>{" "}
                    đơn hàng để được miễn phí vận chuyển
                  </>
                }
                priceLabel="MIỄN PHÍ"
              />
            ))}

          {sortedQuotes.length > 0 && freeShippingInfo && (
            <div className="my-1 flex items-center gap-2.5">
              <span aria-hidden className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/45">
                hoặc thanh toán cước
              </span>
              <span aria-hidden className="h-px flex-1 bg-white/10" />
            </div>
          )}

          {sortedQuotes.map((quote) => {
            const isSelected = selectedQuote?.serviceId === quote.serviceId;
            return (
              <ShipOption
                key={quote.serviceId}
                state="default"
                selected={isSelected}
                onClick={() => onSelectQuote(quote)}
                name={quote.name}
                eta={
                  quote.deliveryDateFormatted ? (
                    <>
                      Giao hàng tối đa{" "}
                      <b className="font-medium text-cyan">
                        {shortenDate(quote.deliveryDateFormatted)}
                      </b>{" "}
                      · {quote.deliveryDays}{" "}
                      {quote.deliveryDays === 1
                        ? "ngày làm việc"
                        : "ngày làm việc"}
                    </>
                  ) : (
                    `${quote.deliveryRange.min} đến ${quote.deliveryRange.max} ngày làm việc`
                  )
                }
                priceLabel={formatCurrency(quote.price)}
              />
            );
          })}
        </div>
      )}

      {hasSearched && !loading && quotes.length === 0 && !error && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">
          Không có lựa chọn vận chuyển cho mã bưu chính này.
        </p>
      )}
    </div>
  );
}

interface ShipOptionProps {
  state: "default" | "locked" | "unlocked";
  selected: boolean;
  onClick: () => void;
  name: string;
  rewardPill?: string;
  eta: React.ReactNode;
  priceLabel: string;
}

function ShipOption({
  state,
  selected,
  onClick,
  name,
  rewardPill,
  eta,
  priceLabel,
}: ShipOptionProps) {
  const isLocked = state === "locked";
  const isUnlocked = state === "unlocked";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      className={cn(
        "relative grid w-full grid-cols-[22px_1fr_auto] items-center gap-3 rounded-xl border bg-black/30 px-3.5 py-3 text-left transition-all duration-[var(--dur-base)]",
        isLocked &&
          "cursor-not-allowed border-dashed border-white/15 opacity-70",
        !isLocked &&
          !selected &&
          "border-white/10 hover:border-cyan/45 hover:bg-cyan/[0.04]",
        selected &&
          !isUnlocked &&
          "border-cyan bg-cyan/[0.06] [box-shadow:var(--glow-cyan-sm)]",

        isUnlocked && !selected && "border-lime/45 bg-lime/[0.05]",
        isUnlocked && selected && "border-lime/55 bg-lime/[0.07]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-[18px] place-items-center rounded-full border-[1.5px] transition-colors",
          selected
            ? isUnlocked
              ? "border-lime"
              : "border-cyan"
            : isLocked
              ? "border-dashed border-white/40"
              : "border-white/45",
        )}
      >
        {selected && (
          <span
            className={cn(
              "block size-2 rounded-full",
              isUnlocked
                ? "bg-lime [box-shadow:0_0_6px_var(--lime)]"
                : "bg-cyan [box-shadow:0_0_6px_var(--cyan)]",
            )}
          />
        )}
      </span>

      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-display text-[13px] tracking-[0.04em]",

              isUnlocked ? "font-bold text-white" : "text-white",
            )}
          >
            {name}
          </span>
          {rewardPill && (
            <span className="rounded border border-lime/55 bg-lime/[0.12] px-1.5 py-[2px] font-mono text-[9px] uppercase tracking-[0.1em] text-white">
              {rewardPill}
            </span>
          )}
        </div>
        <span
          className={cn(
            "font-mono text-[11px] tracking-[0.06em]",
            isLocked ? "text-magenta" : "text-white/55",
          )}
        >
          {eta}
        </span>
      </div>

      <span
        className={cn(
          "whitespace-nowrap text-right font-display text-sm font-bold",

          "text-white",
        )}
      >
        {priceLabel}
      </span>
    </button>
  );
}
