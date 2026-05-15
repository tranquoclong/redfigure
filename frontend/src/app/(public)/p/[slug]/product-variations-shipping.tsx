"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart, Minus, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useCartStore } from "@/store/cart-store";
import { formatCurrency } from "@/lib/constants";
import { trackAddToCart } from "@/lib/ga4-events";
import { trackAddToCart as trackMetaAddToCart } from "@/lib/meta-pixel";
import { WishlistButton } from "@/components/product/wishlist-button";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";
import { BundleComponents } from "@/components/product/bundle-components";

interface Variation {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  image?: string;
  stock: number;
}

interface ScaleItem {
  id: string;
  name: string;
  percentageIncrease: number;
  sortOrder: number;
}

interface ScaleData {
  id: string;
  name: string;
  items: ScaleItem[];
}

interface ShippingQuote {
  serviceId: number;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
  deliveryRange: { min: number; max: number };
  deliveryDate?: string;
  deliveryDateFormatted?: string;
}

interface Props {
  productId: string;
  productSlug: string;
  productType: string;
  basePrice: number;
  salePrice?: number | null;
  variations: Variation[];
  scaleData: ScaleData | null;
  product: Product;
  variationLabel?: string;
  onVariationChange?: (variation: Variation | null) => void;
  onPriceChange?: (price: number) => void;
  onScaleChange?: (scaleName: string | null) => void;
  cartButtonRef?: React.RefObject<HTMLDivElement | null>;
}

export function ProductVariationsAndShipping({
  productId,
  productSlug,
  productType,
  basePrice,
  salePrice,
  variations,
  scaleData,
  product,
  variationLabel = "Phiên bản",
  onVariationChange,
  onPriceChange,
  onScaleChange,
  cartButtonRef,
}: Props) {
  const router = useRouter();
  const setCart = useCartStore((s) => s.setCart);

  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(
    null,
  );
  const isVariable = productType === "variable" && variations.length > 0;

  const hasScales = scaleData !== null && scaleData.items.length > 0;
  const [selectedScaleItem, setSelectedScaleItem] = useState<ScaleItem | null>(
    hasScales
      ? (scaleData!.items.find((i) => i.percentageIncrease === 0) ??
          scaleData!.items[0])
      : null,
  );

  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const [cep, setCep] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cartShippingCep") ?? "";
    if (saved.length === 8 && !cep) {
      setCep(`${saved.slice(0, 5)}-${saved.slice(5)}`);
    }
  }, []);
  const [shippingError, setShippingError] = useState("");
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [freeShippingInfo, setFreeShippingInfo] = useState<{
    eligible: boolean;
    minOrderValue: number;
    remaining: number;
    extraDays: number;
    deliveryDateFormatted?: string;
  } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const rawBasePrice = isVariable
    ? selectedVariation
      ? (selectedVariation.salePrice ?? selectedVariation.price)
      : 0
    : (salePrice ?? basePrice);

  const scalePercentage = selectedScaleItem?.percentageIncrease ?? 0;
  const finalPrice =
    hasScales && scalePercentage > 0
      ? Math.round(rawBasePrice * (1 + scalePercentage / 100) * 100) / 100
      : rawBasePrice;

  useEffect(() => {
    onPriceChange?.(finalPrice);
  }, [finalPrice, onPriceChange]);

  useEffect(() => {
    onScaleChange?.(selectedScaleItem?.name ?? null);
  }, [selectedScaleItem, onScaleChange]);

  const hasDiscount = !isVariable && salePrice != null && salePrice < basePrice;
  const discountPct = hasDiscount
    ? Math.round((1 - salePrice! / basePrice) * 100)
    : 0;

  const isBundle = productType === "bundle";
  const isOutOfStock =
    !isBundle &&
    (() => {
      if (isVariable && selectedVariation) {
        const v = selectedVariation as {
          manageStock?: boolean;
          availableStock?: number | null;
        };
        return v.manageStock !== false && (v.availableStock ?? 0) <= 0;
      }
      if (isVariable) {
        return false;
      }

      return (
        product.manageStock !== false && (product.availableStock ?? 0) <= 0
      );
    })();

  const canAdd =
    (!isVariable || selectedVariation !== null) &&
    finalPrice > 0 &&
    !isOutOfStock;

  function handleSelectVariation(v: Variation) {
    setSelectedVariation(v);
    onVariationChange?.(v);
    setQuotes([]);
    setHasSearched(false);
  }

  async function handleAddToCart() {
    if (!canAdd) return;
    setAddingToCart(true);
    try {
      const { data } = await api.post("/cart/items", {
        productId,
        variationId: selectedVariation?.id,
        scaleId: selectedScaleItem?.id,
        quantity,
      });
      setCart(data.data.items, data.data.subtotal);
      trackAddToCart(product, quantity, {
        variationId: selectedVariation?.id,
        variationName: selectedVariation?.name,
        price: finalPrice,
      });
      trackMetaAddToCart(product, quantity, {
        variationId: selectedVariation?.id,
        price: finalPrice,
      });
      setAddedToCart(true);

      const params = new URLSearchParams();
      if (selectedVariation) {
        params.set("variationLabel", variationLabel);
        params.set("variation", selectedVariation.name);
      }
      if (selectedScaleItem) params.set("scale", selectedScaleItem.name);
      params.set("price", String(finalPrice));
      router.push(`/p/${productSlug}/cart?${params.toString()}`);
    } catch {
    } finally {
      setAddingToCart(false);
    }
  }

  async function doShippingCalc(cleanedCep: string, variationId?: string) {
    setShippingLoading(true);
    setShippingError("");
    setHasSearched(true);
    try {
      const { data } = await api.post("/shipping/quote", {
        zipCode: cleanedCep,
        products: [
          {
            productId,
            variationId: variationId ?? selectedVariation?.id,
            quantity: 1,
          },
        ],
      });
      const result = data.data;
      setQuotes(result.quotes);
      setFreeShippingInfo(result.freeShippingInfo ?? null);
    } catch {
      setShippingError(
        "Lỗi khi tính phí vận chuyển. Vui lòng kiểm tra lại mã bưu điện.",
      );
      setQuotes([]);
    } finally {
      setShippingLoading(false);
    }
  }

  function handleCepInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const formatted =
      digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setCep(formatted);

    if (digits.length === 8) {
      localStorage.setItem("cartShippingCep", digits);
      if (isVariable && !selectedVariation) {
        setShippingError("Vui lòng chọn phiên bản trước");
        return;
      }
      doShippingCalc(digits);
    }
  }

  function handleCalculate() {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      setShippingError("Mã bưu điện phải có 8 chữ số");
      return;
    }
    if (isVariable && !selectedVariation) {
      setShippingError("Vui lòng chọn phiên bản trước");
      return;
    }
    localStorage.setItem("cartShippingCep", cleaned);
    doShippingCalc(cleaned);
  }

  const sortedQuotes = [...quotes].sort((a, b) => a.price - b.price);
  const cheapestId = sortedQuotes.length > 0 ? sortedQuotes[0].serviceId : null;

  return (
    <>
      <div className="mt-6 rounded-2xl border border-purple/25 bg-white/[0.03] p-5 backdrop-blur-sm">
        {isVariable && !selectedVariation ? (
          <div>
            <span className="text-white/50 text-sm">Giá từ</span>
            <span className="ml-2 [font-family:var(--font-orbitron)] text-3xl text-white">
              {formatCurrency(
                Math.min(...variations.map((v) => v.salePrice ?? v.price)),
              )}
            </span>
          </div>
        ) : (
          <>
            {finalPrice > 0 && (
              <>
                <div className="flex items-baseline gap-3">
                  {hasDiscount && (
                    <span className="text-white/40 line-through text-lg">
                      {formatCurrency(basePrice)}
                    </span>
                  )}
                  <span className="[font-family:var(--font-orbitron)] text-4xl text-white drop-shadow-[0_0_20px_rgba(184,41,255,0.4)]">
                    {formatCurrency(finalPrice)}
                  </span>
                  {hasDiscount && discountPct > 0 && (
                    <span className="rounded-full bg-purple/20 border border-purple/40 px-2 py-0.5 text-xs text-purple font-medium">
                      -{discountPct}%
                    </span>
                  )}
                </div>
                {hasScales && scalePercentage > 0 && (
                  <p className="text-xs text-white/40 mt-1">
                    Giá cơ bản: {formatCurrency(rawBasePrice)} + Tăng:{" "}
                    {formatCurrency(finalPrice - rawBasePrice)}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      {hasScales && (
        <div className="mt-6">
          <div className="[font-family:var(--font-orbitron)] text-xs tracking-wider text-white/70 mb-2">
            TỈ LỆ
          </div>
          <div
            className={cn(
              "grid gap-2",
              scaleData!.items.length <= 4
                ? "grid-cols-4"
                : "grid-cols-3 sm:grid-cols-4",
            )}
          >
            {scaleData!.items
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => {
                const isSelected = selectedScaleItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedScaleItem(item)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-center transition-all cursor-pointer",
                      isSelected
                        ? "border-cyan bg-gradient-to-b from-cyan/10 to-cyan/[0.02] shadow-[0_0_18px_rgba(0,240,255,0.25)]"
                        : "border-purple/40 bg-white/[0.02] hover:border-purple/70",
                    )}
                  >
                    <div className="[font-family:var(--font-orbitron)] text-sm text-white">
                      {item.name}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {isVariable && (
        <div className="mt-5">
          <div className="[font-family:var(--font-orbitron)] text-xs tracking-wider text-white/70 mb-2">
            {variationLabel.toUpperCase()}
          </div>
          <div className="relative">
            <select
              value={selectedVariation?.id ?? ""}
              onChange={(e) => {
                const v = variations.find((v) => v.id === e.target.value);
                if (v) handleSelectVariation(v);
                else {
                  setSelectedVariation(null);
                  onVariationChange?.(null);
                }
              }}
              className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan/70 transition-colors"
            >
              <option value="">Chọn một phiên bản</option>
              {variations.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {formatCurrency(v.salePrice ?? v.price)}
                </option>
              ))}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan pointer-events-none">
              ▾
            </span>
          </div>
        </div>
      )}

      {productType === "bundle" &&
        product.bundleComponents &&
        product.bundleComponents.length > 0 && (
          <div className="mt-6">
            <BundleComponents
              components={product.bundleComponents}
              discount={product.bundleDiscount ?? 0}
            />
          </div>
        )}

      <div ref={cartButtonRef} className="mt-7 flex gap-3">
        <div className="flex items-center border border-white/10 rounded-full overflow-hidden">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            className="px-4 py-3 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(quantity + 1)}
            className="px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <Button
          variant="neon"
          size="lg"
          className="flex-1 rounded-full"
          onClick={handleAddToCart}
          disabled={addingToCart || !canAdd}
        >
          <ShoppingCart className="mr-2 h-5 w-5" />
          {addedToCart
            ? "Thêm vào giỏ hàng!"
            : addingToCart
              ? "Đang thêm..."
              : "THÊM VÀO GIỎ HÀNG"}
        </Button>
        <WishlistButton
          productId={productId}
          productSlug={productSlug}
          product={product}
          className="h-12 w-12 rounded-full border border-white/10 hover:border-cyan/50 transition-colors"
        />
      </div>

      {isVariable && !selectedVariation && (
        <p className="text-xs text-center text-white/40 mt-2">
          Vui lòng chọn một phiên bản để thêm vào giỏ hàng
        </p>
      )}

      {isOutOfStock && (
        <p className="text-xs text-center text-red-400 mt-2 font-medium">
          Sản phẩm tạm thời hết hàng
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-purple/25 bg-white/[0.03] p-5 backdrop-blur-sm">
        <div className="[font-family:var(--font-orbitron)] text-xs tracking-wider mb-3">
          TÍNH PHÍ VẬN CHUYỂN & THỜI GIAN
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => handleCepInput(e.target.value)}
            maxLength={9}
            className="flex-1 bg-black/40 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan/70 transition-colors"
          />
          <button
            type="button"
            onClick={handleCalculate}
            disabled={shippingLoading || cep.replace(/\D/g, "").length !== 8}
            className="rounded-full border border-cyan/40 px-5 py-2.5 [font-family:var(--font-orbitron)] text-xs text-cyan tracking-wider hover:bg-cyan/10 disabled:opacity-40 transition-colors"
          >
            {shippingLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "TÍNH TOÁN"
            )}
          </button>
        </div>

        {shippingError && (
          <p className="text-xs text-magenta mt-2">{shippingError}</p>
        )}

        {hasSearched && sortedQuotes.length > 0 && (
          <div className="mt-4 space-y-2 text-sm">
            {freeShippingInfo &&
              (() => {
                return (
                  <div
                    className={cn(
                      "rounded-xl border px-4 py-3",
                      freeShippingInfo.eligible
                        ? "border-green-500/40 bg-green-500/10"
                        : "border-green-500/20 bg-green-500/5",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-green-400 shrink-0" />
                      <span className="font-medium text-green-400">
                        Miễn phí vận chuyển
                      </span>
                      {freeShippingInfo.eligible && (
                        <span className="text-[10px] bg-green-500/20 border border-green-500/40 text-green-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Mở khóa
                        </span>
                      )}
                    </div>

                    {freeShippingInfo.eligible ? (
                      <div className="mt-1">
                        <p className="text-xs text-green-400/70">
                          {freeShippingInfo.deliveryDateFormatted
                            ? `Giao hàng trước ${freeShippingInfo.deliveryDateFormatted}`
                            : "Prazo calculado após confirmação"}
                        </p>
                        <div className="[font-family:var(--font-orbitron)] text-green-400 mt-1">
                          Miễn phí
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <p className="text-white/70">
                          Mua thêm{" "}
                          <span className="font-bold text-green-400">
                            {formatCurrency(freeShippingInfo.minOrderValue)}
                          </span>{" "}
                          để được miễn phí vận chuyển
                        </p>
                        {freeShippingInfo.deliveryDateFormatted && (
                          <p className="text-xs text-white/40 mt-0.5">
                            Giao hàng trước{" "}
                            {freeShippingInfo.deliveryDateFormatted}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            {sortedQuotes.map((quote) => {
              const isCheapest =
                quote.serviceId === cheapestId && sortedQuotes.length > 1;
              return (
                <div
                  key={quote.serviceId}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-3 transition-colors",
                    isCheapest
                      ? "border-cyan/60 bg-cyan/5"
                      : "border-white/10 hover:border-cyan/40",
                  )}
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {quote.name}
                      {isCheapest && (
                        <span className="rounded-full bg-cyan/20 border border-cyan/40 px-2 py-0.5 text-[10px] text-cyan uppercase tracking-wider">
                          Tốt nhất
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/50">
                      {quote.deliveryDateFormatted
                        ? `Giao hàng trước ${quote.deliveryDateFormatted}`
                        : `${quote.deliveryRange.min} a ${quote.deliveryRange.max} ngày`}
                    </div>
                  </div>
                  <div className="[font-family:var(--font-orbitron)] text-cyan whitespace-nowrap">
                    {formatCurrency(quote.price)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasSearched &&
          !shippingLoading &&
          quotes.length === 0 &&
          !shippingError && (
            <p className="text-xs text-white/40 mt-2">
              Không có tùy chọn vận chuyển cho mã ZIP này.
            </p>
          )}
      </div>
    </>
  );
}
