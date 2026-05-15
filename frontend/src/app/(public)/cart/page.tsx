"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ShippingCalculator,
  type ShippingQuote,
  type FreeShippingInfo,
} from "@/components/shared/shipping-calculator";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { CartCoupon } from "@/components/cart/cart-coupon";
import {
  CartSummary,
  type PaymentMethodId,
  type PaymentMethodSummaryUI,
} from "@/components/cart/cart-summary";
import { CartUpsell } from "@/components/cart/cart-upsell";
import { FreeShippingPromise } from "@/components/cart/free-shipping-promise";
import { FreeGiftProgress } from "@/components/cart/free-gift-progress";
import { FreeGiftCartItem } from "@/components/cart/free-gift-cart-item";
import { api } from "@/lib/api-client";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { ROUTES } from "@/lib/constants";
import { extractApiError } from "@/lib/extract-error";
import type {
  CartItem,
  RevalidatedCart,
  RevalidatedCartItem,
} from "@/types/cart";

interface CouponResult {
  code: string;
  couponId: string;
  discount: number;
}

const MAX_STACKED_COUPONS = 3;

function itemKey(item: CartItem): string {
  return item.productId + (item.variationId ?? "") + (item.scaleId ?? "");
}

function loadSavedCoupons(): CouponResult[] {
  if (typeof window === "undefined") return [];
  const saved = localStorage.getItem("cartCoupons");
  if (!saved) {
    const legacy = localStorage.getItem("cartCoupon");
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as {
          code?: string;
          discount?: number;
        };
        if (parsed.code && typeof parsed.discount === "number") {
          return [
            { code: parsed.code, couponId: "", discount: parsed.discount },
          ];
        }
      } catch {}
      localStorage.removeItem("cartCoupon");
    }
    return [];
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (c): c is CouponResult =>
            !!c && typeof c.code === "string" && typeof c.discount === "number",
        )
        .slice(0, MAX_STACKED_COUPONS);
    }
  } catch {
    localStorage.removeItem("cartCoupons");
  }
  return [];
}

function persistCoupons(coupons: CouponResult[]) {
  if (typeof window === "undefined") return;
  if (coupons.length === 0) {
    localStorage.removeItem("cartCoupons");
  } else {
    localStorage.setItem("cartCoupons", JSON.stringify(coupons));
  }
  localStorage.removeItem("cartCoupon");
}

export default function CartPage() {
  const { items, subtotal, setCart, clear } = useCartStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupons, setAppliedCoupons] =
    useState<CouponResult[]>(loadSavedCoupons);
  const [couponError, setCouponError] = useState("");
  const [userCep, setUserCep] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedShipping, setSelectedShipping] =
    useState<ShippingQuote | null>(() => {
      if (typeof window === "undefined") return null;
      try {
        const saved = localStorage.getItem("cartShipping");
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    });
  const [savedCep, setSavedCep] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("cartShippingCep") ?? "";
  });

  const [freeShippingInfo, setFreeShippingInfo] =
    useState<FreeShippingInfo | null>(null);

  function handleSelectShipping(quote: ShippingQuote) {
    setSelectedShipping(quote);
    localStorage.setItem("cartShipping", JSON.stringify(quote));
  }

  function handleCepChange(cep: string) {
    setSavedCep(cep);
    localStorage.setItem("cartShippingCep", cep);
  }

  const [paymentSummaries, setPaymentSummaries] = useState<
    PaymentMethodSummaryUI[]
  >([]);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>(() => {
    if (typeof window === "undefined") return "cod";
    const saved = localStorage.getItem("cartPaymentMethod");
    if (saved === "cod" || saved === "sepay" || saved === "credit_card") {
      return saved;
    }
    return "cod";
  });
  function handleSelectMethod(id: PaymentMethodId) {
    setSelectedMethod(id);

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("cartPaymentMethod", id);
      }
    } catch {}
  }
  const [revalidatedItems, setRevalidatedItems] = useState<
    RevalidatedCartItem[]
  >([]);
  const [cleaning, setCleaning] = useState(false);

  const [stockBouncedFromCheckout, setStockBouncedFromCheckout] =
    useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setStockBouncedFromCheckout(params.get("stock_changed") === "1");
  }, []);

  useEffect(() => {
    api
      .get<{ data: RevalidatedCart }>("/cart?revalidate=true")
      .then(({ data }) => {
        setCart(data.data.items, data.data.subtotal);
        setRevalidatedItems(data.data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api
      .get("/payments/methods")
      .then(({ data }) => {
        type M = {
          id: "cod" | "sepay" | "credit_card";
          enabled: boolean;
          discount: number;
          label?: string;
          maxInstallments?: number;
        };
        const list = (
          Array.isArray(data?.data) ? (data.data as M[]) : []
        ).filter((m) => m.enabled);
        const summaries: PaymentMethodSummaryUI[] = list.map((m) => ({
          id: m.id,
          enabled: m.enabled,
          discount: m.discount ?? 0,
          label:
            m.id === "cod"
              ? "COD"
              : m.id === "credit_card"
                ? "Thẻ Tín Dụng"
                : "sepay",
          ...(m.id === "credit_card" &&
            typeof m.maxInstallments === "number" && {
              maxInstallments: m.maxInstallments,
            }),
        }));
        setPaymentSummaries(summaries);

        setSelectedMethod((current) => {
          const stillEnabled = summaries.some((m) => m.id === current);
          if (stillEnabled) return current;
          const fallback =
            summaries.find((m) => m.id === "cod")?.id ?? summaries[0]?.id;
          if (fallback && typeof window !== "undefined") {
            try {
              localStorage.setItem("cartPaymentMethod", fallback);
            } catch {}
          }
          return fallback ?? current;
        });
      })
      .catch(() => {});
  }, [setCart]);

  function findRevalidated(item: CartItem): RevalidatedCartItem | undefined {
    return revalidatedItems.find(
      (r) =>
        (r.productId ?? r.quoteItemId) ===
          (item.productId ?? item.quoteItemId) &&
        (r.variationId ?? "") === (item.variationId ?? "") &&
        (r.scaleId ?? "") === (item.scaleId ?? ""),
    );
  }

  const outOfStockCount = revalidatedItems.filter((i) => i.outOfStock).length;
  const hasOutOfStock = outOfStockCount > 0;
  const hasPriceChanges = revalidatedItems.some((i) => i.priceChanged);

  async function handleCleanOutOfStock() {
    setCleaning(true);
    try {
      const { data } = await api.post<{ data: RevalidatedCart }>(
        "/cart/clean-out-of-stock",
      );
      setCart(data.data.items, data.data.subtotal);
      setRevalidatedItems(data.data.items);
    } catch (err) {
      extractApiError(err, "Lỗi khi xóa sản phẩm hết hàng");
    } finally {
      setCleaning(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || savedCep) return;
    api
      .get("/addresses")
      .then(({ data }) => {
        const addrs = data.data ?? [];
        if (addrs.length > 0) {
          const defaultAddr =
            addrs.find((a: { isDefault?: boolean }) => a.isDefault) ?? addrs[0];
          const cep = (defaultAddr.postalCode ?? "").replace(/\D/g, "");
          if (cep.length === 8) {
            setUserCep(cep);
            handleCepChange(cep);
          }
        }
      })
      .catch(() => {});
  }, [isAuthenticated, savedCep]);

  async function handleUpdateQuantity(item: CartItem, nextQty: number) {
    if (!item.productId) return;
    try {
      const params = new URLSearchParams();
      if (item.variationId) params.set("variationId", item.variationId);
      if (item.scaleId) params.set("scaleId", item.scaleId);
      const qs = params.toString();
      const { data } = await api.put(
        `/cart/items/${item.productId}${qs ? `?${qs}` : ""}`,
        { quantity: nextQty },
      );
      setCart(data.data.items, data.data.subtotal);
    } catch {}
  }

  async function handleRemove(item: CartItem) {
    try {
      if (item.quoteItemId) {
        const { data } = await api.delete(
          `/cart/items/quote/${item.quoteItemId}`,
        );
        setCart(data.data.items, data.data.subtotal);
        return;
      }
      if (!item.productId) return;
      const params = new URLSearchParams();
      if (item.variationId) params.set("variationId", item.variationId);
      if (item.scaleId) params.set("scaleId", item.scaleId);
      const qs = params.toString();
      const { data } = await api.delete(
        `/cart/items/${item.productId}${qs ? `?${qs}` : ""}`,
      );
      setCart(data.data.items, data.data.subtotal);
    } catch {}
  }

  async function handleClear() {
    try {
      await api.delete("/cart");
      clear();
    } catch {}
  }

  async function handleApplyCoupon() {
    setCouponError("");
    const trimmed = couponCode.trim().toUpperCase();
    if (!trimmed) return;

    if (appliedCoupons.length >= MAX_STACKED_COUPONS) {
      setCouponError(
        `Tối đa ${MAX_STACKED_COUPONS} mã giảm giá cho mỗi đơn hàng.`,
      );
      return;
    }
    if (appliedCoupons.some((c) => c.code === trimmed)) {
      setCouponError("Mã giảm giá đã được áp dụng.");
      return;
    }

    try {
      const { data } = await api.post("/coupons/validate", {
        code: trimmed,
        cartValue: subtotal,
        appliedCouponIds: appliedCoupons.map((c) => c.couponId).filter(Boolean),
      });
      const next: CouponResult = {
        code: trimmed,
        couponId: data.data.couponId,
        discount: data.data.discount,
      };
      const updated = [...appliedCoupons, next];
      setAppliedCoupons(updated);
      persistCoupons(updated);
      setCouponCode("");
    } catch (err) {
      setCouponError(
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Mã giảm giá không hợp lệ",
      );
    }
  }

  function removeCoupon(code: string) {
    const updated = appliedCoupons.filter((c) => c.code !== code);
    setAppliedCoupons(updated);
    persistCoupons(updated);
    setCouponError("");
  }

  const couponDiscount = useMemo(
    () => appliedCoupons.reduce((sum, c) => sum + c.discount, 0),
    [appliedCoupons],
  );

  const subtotalAfterCoupons = Math.max(0, subtotal - couponDiscount);

  const upsellExcludeIds = useMemo(
    () =>
      items
        .map((i) => i.productId)
        .filter((id): id is string => typeof id === "string"),
    [items],
  );

  const upsellBrandIds = useMemo(() => {
    const seen = new Set<string>();
    for (const r of revalidatedItems) {
      if (r.brandId) seen.add(r.brandId);
    }
    return Array.from(seen);
  }, [revalidatedItems]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 text-center text-white/60 sm:px-6 lg:px-8">
        Đang tải giỏ hàng...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-3 text-xs text-white/55">
          <Link href={ROUTES.home} className="hover:text-cyan">
            Trang chủ
          </Link>
          <span className="mx-2">·</span>
          <span className="text-cyan">Giỏ hàng</span>
        </div>
        <PageHead itemCount={0} />
        <CheckoutStepper currentStep={1} className="mb-12" />
        <div className="rounded-3xl border border-purple/25 bg-white/[0.02] p-16 text-center backdrop-blur-sm">
          <ShoppingBag className="mx-auto size-14 text-white/20" />
          <h2 className="mt-6 font-display text-2xl uppercase tracking-wide text-white">
            Giỏ hàng của bạn trống
          </h2>
          <p className="mt-2 text-white/55">Thêm sản phẩm để bắt đầu.</p>
          <Link href={ROUTES.products} className="mt-6 inline-block">
            <Button variant="neon" className="rounded-full px-8 py-6 text-xs">
              Khám phá sản phẩm →
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-3 text-xs text-white/55">
        <Link href={ROUTES.home} className="hover:text-cyan">
          Trang chủ
        </Link>
        <span className="mx-2">·</span>
        <span className="text-cyan">Giỏ hàng</span>
      </div>

      <PageHead itemCount={items.length} />

      <CheckoutStepper currentStep={1} className="mb-9" />

      {stockBouncedFromCheckout && hasOutOfStock && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">
            Quay lại giỏ hàng — số lượng hàng tồn kho đã thay đổi.
          </p>
          <p className="mt-1 text-xs text-amber-100/80">
            Một số mặt hàng đã hết hàng kể từ lần truy cập cuối cùng. Vui lòng
            xóa bên dưới để tiếp tục thanh toán.
          </p>
        </div>
      )}

      {(hasOutOfStock || hasPriceChanges) && (
        <div className="mb-6 space-y-3">
          {hasOutOfStock && (
            <div className="flex items-start justify-between gap-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <div className="text-sm text-red-200">
                <p className="font-semibold">
                  {outOfStockCount === 1
                    ? "1 mặt hàng hết hàng"
                    : `${outOfStockCount} mặt hàng hết hàng`}
                </p>
                <p className="mt-1 text-xs text-red-200/80">
                  Không thể hoàn tất thanh toán với các mặt hàng đã hết hàng.
                  Vui lòng xóa để tiếp tục thanh toán.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleCleanOutOfStock}
                disabled={cleaning}
                className="shrink-0 border border-red-500/40 bg-red-500/20 text-red-100 hover:bg-red-500/30"
              >
                {cleaning ? "Đang xóa…" : "Xóa sản phẩm"}
              </Button>
            </div>
          )}
          {hasPriceChanges && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-semibold">
                Giá đã thay đổi kể từ khi thêm vào giỏ hàng
              </p>
              <p className="mt-1 text-xs text-amber-100/80">
                Tổng tiền bên dưới đã phản ánh giá hiện tại.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid items-start gap-8 pb-16 lg:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <FreeGiftProgress subtotalOverride={subtotalAfterCoupons} />

          <div className="flex flex-col gap-3.5">
            {items.map((item) => {
              if (item.isFreeGift) {
                return <FreeGiftCartItem key={itemKey(item)} item={item} />;
              }
              const rev = findRevalidated(item);
              return (
                <CartItemRow
                  key={itemKey(item)}
                  item={item}
                  revalidated={rev}
                  brandName={item.brandName ?? rev?.brandName ?? null}
                  productSlug={item.productSlug ?? rev?.productSlug ?? null}
                  productionDays={rev?.productionDays ?? null}
                  onUpdateQuantity={(next) => handleUpdateQuantity(item, next)}
                  onRemove={() => handleRemove(item)}
                />
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
            <Link
              href={ROUTES.products}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-white/65 transition hover:text-cyan"
            >
              ← Tiếp tục mua sắm
            </Link>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] text-white/55 transition hover:text-magenta"
            >
              <Trash2 className="size-3" />
              Xóa giỏ hàng
            </button>
          </div>

          {upsellBrandIds.length > 0 && (
            <CartUpsell
              excludeIds={upsellExcludeIds}
              brandIds={upsellBrandIds}
            />
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {freeShippingInfo && freeShippingInfo.minOrderValue > 0 && (
            <FreeShippingPromise
              subtotal={subtotalAfterCoupons}
              minOrderValue={freeShippingInfo.minOrderValue}
              remaining={freeShippingInfo.remaining}
              eligible={freeShippingInfo.eligible}
            />
          )}

          <CartCoupon
            applied={appliedCoupons}
            max={MAX_STACKED_COUPONS}
            code={couponCode}
            setCode={setCouponCode}
            error={couponError}
            onApply={handleApplyCoupon}
            onRemove={removeCoupon}
          />

          <CartSummary
            itemCount={items.length}
            subtotal={subtotal}
            shipping={
              selectedShipping
                ? { name: selectedShipping.name, price: selectedShipping.price }
                : null
            }
            couponDiscount={couponDiscount}
            appliedCouponCodes={appliedCoupons.map((c) => c.code)}
            paymentMethods={paymentSummaries}
            selectedMethod={selectedMethod}
            onSelectMethod={handleSelectMethod}
            hasOutOfStock={hasOutOfStock}
            shippingMissing={selectedShipping == null}
          />
        </aside>
      </div>
    </div>
  );
}

interface PageHeadProps {
  itemCount: number;
}

function PageHead({ itemCount }: PageHeadProps) {
  return (
    <div className="mb-7 flex flex-wrap items-baseline gap-3">
      <h1 className="text-4xl font-black uppercase tracking-[0.02em] text-white sm:text-5xl">
        Giỏ hàng
      </h1>
      <span className="font-mono text-sm tracking-[0.08em] text-white/45">
        {`// ${itemCount} sản phẩm`}
      </span>
    </div>
  );
}
