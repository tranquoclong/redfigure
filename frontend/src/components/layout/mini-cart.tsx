"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Truck, Trash2, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { useMiniCart } from "@/hooks/use-mini-cart";
import { useCart } from "@/hooks/use-cart";
import { ROUTES, formatCurrency } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/types/cart";
import type { FreeShippingInfo } from "@/components/shared/shipping-calculator";
import { FreeGiftProgress } from "@/components/cart/free-gift-progress";

export function MiniCart() {
  const { open, setOpen, closeCart } = useMiniCart();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal);
  const itemCount = useCartStore((s) => s.itemCount);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { updateQuantity, removeItem } = useCart();

  const [direction, setDirection] = useState<"right" | "bottom">("bottom");
  const [freeShippingInfo, setFreeShippingInfo] =
    useState<FreeShippingInfo | null>(null);
  const [noCep, setNoCep] = useState(false);
  const [miniCep, setMiniCep] = useState("");
  const [miniCepLoading, setMiniCepLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const lastFetchKey = useRef("");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setDirection(mql.matches ? "right" : "bottom");
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const fetchFreeShipping = useCallback(
    async (cep: string) => {
      if (cep.length !== 8 || items.length === 0) return;
      const fetchKey = `${cep}:${items
        .map((i) => `${i.productId}:${i.quantity}`)
        .join(",")}`;
      if (fetchKey === lastFetchKey.current) return;
      lastFetchKey.current = fetchKey;
      try {
        const { data } = await api.post("/shipping/quote", {
          zipCode: cep,
          products: items.map((i) => ({
            productId: i.productId,
            variationId: i.variationId,
            quantity: i.quantity,
          })),
        });
        setFreeShippingInfo(data.data.freeShippingInfo ?? null);
        setNoCep(false);
      } catch {
        setFreeShippingInfo(null);
      }
    },
    [items],
  );

  useEffect(() => {
    if (!open || items.length === 0) return;
    async function resolve() {
      const savedCep =
        typeof window !== "undefined"
          ? localStorage.getItem("cartShippingCep")
          : null;
      if (savedCep && savedCep.length === 8) {
        await fetchFreeShipping(savedCep);
        return;
      }
      if (isAuthenticated) {
        try {
          const { data } = await api.get("/addresses");
          const addrs = data.data ?? [];
          if (addrs.length > 0) {
            const addr =
              addrs.find((a: { isDefault?: boolean }) => a.isDefault) ??
              addrs[0];
            const cep = (addr.postalCode ?? "").replace(/\D/g, "");
            if (cep.length === 8) {
              localStorage.setItem("cartShippingCep", cep);
              await fetchFreeShipping(cep);
              return;
            }
          }
        } catch {}
      }
      setFreeShippingInfo(null);
      setNoCep(true);
    }
    resolve();
  }, [open, items, isAuthenticated, fetchFreeShipping]);

  function handleMiniCepInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const formatted =
      digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setMiniCep(formatted);
    if (digits.length === 8) {
      setMiniCepLoading(true);
      localStorage.setItem("cartShippingCep", digits);
      fetchFreeShipping(digits).finally(() => setMiniCepLoading(false));
    }
  }

  async function handleQty(item: CartItem, delta: number) {
    if (!item.productId) return;
    const newQty = Math.max(1, item.quantity + delta);
    if (newQty === item.quantity) return;
    const id = `${item.productId}:${item.variationId ?? ""}:${item.scaleId ?? ""}`;
    setPendingId(id);
    try {
      await updateQuantity(
        item.productId,
        newQty,
        item.variationId,
        item.scaleId,
      );
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(item: CartItem) {
    if (!item.productId) return;
    const id = `${item.productId}:${item.variationId ?? ""}:${item.scaleId ?? ""}`;
    setPendingId(id);
    try {
      await removeItem(item.productId, item.variationId, item.scaleId);
    } finally {
      setPendingId(null);
    }
  }

  const progressPct = freeShippingInfo
    ? Math.min(
        100,
        ((freeShippingInfo.minOrderValue - freeShippingInfo.remaining) /
          freeShippingInfo.minOrderValue) *
          100,
      )
    : 0;

  return (
    <Drawer open={open} onOpenChange={setOpen} direction={direction}>
      <DrawerContent
        data-testid="mini-cart"
        className={cn(
          "flex flex-col border-purple/25 bg-ink/95 backdrop-blur-md",

          "lg:!right-0 lg:!top-0 lg:!h-full lg:!max-h-screen lg:!w-[440px] lg:!max-w-[440px] lg:border-l",

          "max-h-[85vh] border-t",
        )}
      >
        <DrawerHeader className="shrink-0 border-b border-white/10 px-5 py-4 lg:px-6">
          <DrawerTitle className="flex items-center gap-3 text-white">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-purple/40 bg-purple/[0.12] text-magenta">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <span className="text-[14px] font-extrabold uppercase tracking-[0.14em]">
              Giỏ hàng
            </span>
            <span className="text-[11px] tracking-[0.08em] [font-family:var(--font-mono)] text-cyan/80">
              {`// ${itemCount} sản phẩm`}
            </span>
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Tổng quan các sản phẩm đã thêm vào giỏ hàng
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-white/15" />
              <p className="text-sm text-white/40">Giỏ hàng đang trống</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const id = `${item.productId}:${item.variationId ?? ""}:${item.scaleId ?? ""}`;
                const pending = pendingId === id;
                const isFreeGift = item.isFreeGift === true;
                return (
                  <li
                    key={id}
                    data-testid="mini-cart-item"
                    className={cn(
                      "relative flex gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5",
                      pending && "opacity-50",
                    )}
                  >
                    {item.image ? (
                      <div className="relative h-[70px] w-[70px] shrink-0 overflow-hidden rounded-lg border border-white/10 lg:h-[84px] lg:w-[84px]">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="84px"
                        />
                      </div>
                    ) : (
                      <div className="h-[70px] w-[70px] shrink-0 rounded-lg bg-white/5 lg:h-[84px] lg:w-[84px]" />
                    )}

                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="line-clamp-2 pr-7 text-xs font-medium leading-tight text-white">
                        {item.name}
                      </p>
                      {item.scaleName && (
                        <p className="mt-0.5 text-[10px] [font-family:var(--font-mono)] text-white/40">
                          Tỷ lệ:{" "}
                          <span className="text-white/70">
                            {item.scaleName}
                          </span>
                        </p>
                      )}
                      {item.variationName && (
                        <p className="text-[10px] [font-family:var(--font-mono)] text-white/40">
                          {item.variationLabel ?? "Phiên bản"}:{" "}
                          <span className="text-white/70">
                            {item.variationName}
                          </span>
                        </p>
                      )}

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        {!isFreeGift && item.productId ? (
                          <div className="inline-flex items-center gap-0 overflow-hidden rounded-md border border-white/10">
                            <button
                              type="button"
                              aria-label="Giảm số lượng"
                              onClick={() => handleQty(item, -1)}
                              disabled={item.quantity === 1 || pending}
                              className="grid h-7 w-7 place-items-center text-white/70 transition-colors hover:bg-white/5 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span
                              data-testid="mini-cart-item-qty"
                              className="min-w-7 px-1 text-center text-[11px] [font-family:var(--font-mono)] font-bold text-white"
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Tăng số lượng"
                              onClick={() => handleQty(item, 1)}
                              disabled={pending}
                              className="grid h-7 w-7 place-items-center text-white/70 transition-colors hover:bg-white/5 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/40">
                            {item.quantity}x
                          </span>
                        )}
                        <span className="text-xs font-bold text-cyan">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>

                      {item.bundleChildren &&
                        item.bundleChildren.length > 0 && (
                          <ul className="mt-2 space-y-1 border-t border-white/5 pt-1.5">
                            {item.bundleChildren.map((child, ci) => (
                              <li key={ci} className="flex items-center gap-2">
                                {child.image && (
                                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                                    <Image
                                      src={child.image}
                                      alt={child.name}
                                      fill
                                      className="object-cover"
                                      sizes="32px"
                                    />
                                  </div>
                                )}
                                <p className="min-w-0 flex-1 truncate text-[10px] text-white/60">
                                  {child.name}
                                </p>
                                <span className="shrink-0 text-[10px] [font-family:var(--font-mono)] text-white/40">
                                  {child.quantity * item.quantity}x
                                </span>
                                <span className="shrink-0 text-[10px] text-cyan">
                                  {formatCurrency(child.discountedPrice)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>

                    {!isFreeGift && item.productId && (
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => handleRemove(item)}
                        disabled={pending}
                        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-white/40 transition-colors hover:bg-magenta/10 hover:text-magenta disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <DrawerFooter className="shrink-0 space-y-3 border-t border-white/10 px-4 py-3">
            <FreeGiftProgress compact />

            <div className="rounded-lg border border-[rgba(0,255,136,0.2)] bg-[linear-gradient(90deg,rgba(0,255,136,.06),rgba(0,240,255,.04))] px-3 py-2.5">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.06em] [font-family:var(--font-orbitron)] text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#00ff88] [box-shadow:0_0_10px_#00ff88]" />
                <Truck className="h-3.5 w-3.5 text-[#00ff88]" />
                Miễn phí vận chuyển!
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-bold uppercase tracking-[0.1em] [font-family:var(--font-orbitron)] text-white/72">
                  Subtotal
                </span>
                <span className="text-[22px] font-black [font-family:var(--font-orbitron)] text-white">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] [font-family:var(--font-mono)] text-cyan">
                  — hoặc QR
                </span>
                <span className="text-[12px] font-bold [font-family:var(--font-mono)] text-cyan">
                  {formatCurrency(subtotal * 0.95)} (-5%)
                </span>
              </div>
              <p className="pt-0.5 text-[10px] [font-family:var(--font-mono)] text-white/40">
                Phí vận chuyển và thuế được tính khi thanh toán.
              </p>
            </div>

            <div className="grid gap-2 pt-1">
              <Link
                href={
                  isAuthenticated
                    ? ROUTES.checkout
                    : ROUTES.checkoutIdentification
                }
                onClick={closeCart}
              >
                <Button
                  variant="neon"
                  size="lg"
                  className="w-full rounded-lg text-xs"
                >
                  Thanh toán →
                </Button>
              </Link>
              <Link href={ROUTES.cart} onClick={closeCart}>
                <Button
                  variant="ghost-neon"
                  size="lg"
                  className="w-full rounded-lg text-xs"
                >
                  Xem giỏ hàng
                </Button>
              </Link>
              <button
                type="button"
                onClick={closeCart}
                className="py-1.5 text-center text-[11px] uppercase tracking-[0.08em] text-white/45 transition-colors hover:text-white/70"
              >
                ← Tiếp tục mua hàng
              </button>
            </div>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
