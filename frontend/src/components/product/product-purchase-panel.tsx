"use client";

import { useState, useMemo, forwardRef } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Check,
  Package,
  ShieldCheck,
  Clock,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/product/wishlist-button";
import { Button } from "@/components/ui/button";
import { OptionChip } from "./option-chip";
import { PdpShippingEstimate } from "./pdp-shipping-estimate";
import {
  usePdpPricing,
  type PdpScaleItem,
  type PdpVariation,
} from "@/hooks/use-pdp-pricing";
import { formatCurrency } from "@/lib/constants";
import { reportError, isReportableHttpStatus } from "@/lib/error-reporter";

export interface PurchaseScaleItem extends PdpScaleItem {
  meta?: string;
}

export interface PurchaseVariation extends PdpVariation {
  name: string;
  description?: string;
}

export interface ProductPurchasePanelProps {
  productId: string;
  productSlug: string;
  productName: string;
  productSubtitle?: string;
  basePrice: number;
  baseSalePrice?: number | null;
  brand?: { id: string; name: string; slug?: string };
  isNsfw?: boolean;

  category?: { name: string; slug?: string } | string;

  averageRating?: number;
  reviewCount?: number;

  scales: PurchaseScaleItem[];
  variations: PurchaseVariation[];
  variationAxisLabel?: string;
  productionDays?: number;

  onAddToCart: (payload: {
    scaleId?: string;
    variationId?: string;
    quantity: number;
  }) => Promise<void> | void;
  onSelectionChange?: (state: {
    scale: PurchaseScaleItem | null;
    variation: PurchaseVariation | null;
  }) => void;
}

export const ProductPurchasePanel = forwardRef<
  HTMLDivElement,
  ProductPurchasePanelProps
>(function ProductPurchasePanel(
  {
    productId,
    productSlug,
    productName,
    productSubtitle,
    basePrice,
    baseSalePrice,
    brand,
    isNsfw = false,
    category,
    averageRating,
    reviewCount = 0,
    scales,
    variations,
    variationAxisLabel = "Phiên bản",
    productionDays = 6,
    onAddToCart,
    onSelectionChange,
  },
  ref,
) {
  const initialScale = useMemo(
    () => scales.find((s) => s.percentageIncrease === 0) ?? scales[0] ?? null,
    [scales],
  );

  const [selectedScale, setSelectedScale] = useState<PurchaseScaleItem | null>(
    initialScale,
  );
  const [selectedVariation, setSelectedVariation] =
    useState<PurchaseVariation | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [shakeStep2, setShakeStep2] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requireVariation = variations.length > 0;
  const hasSelection = !requireVariation || selectedVariation != null;

  const availableVariations = useMemo(
    () =>
      variations.map((v) => ({
        id: v.id,
        price: v.price,
        salePrice: v.salePrice,
      })),
    [variations],
  );

  const deltaBasePrice = useMemo(() => {
    if (basePrice > 0) return basePrice;
    if (variations.length > 0) {
      return Math.min(...variations.map((v) => v.salePrice ?? v.price));
    }
    return basePrice;
  }, [basePrice, variations]);

  const pricing = usePdpPricing({
    basePrice,
    baseSalePrice,
    selectedScale,
    selectedVariation: selectedVariation
      ? {
          id: selectedVariation.id,
          price: selectedVariation.price,
          salePrice: selectedVariation.salePrice,
        }
      : null,
    availableVariations,
  });

  const handleSelectScale = (scale: PurchaseScaleItem) => {
    setSelectedScale(scale);
    onSelectionChange?.({ scale, variation: selectedVariation });
  };

  const handleSelectVariation = (variation: PurchaseVariation) => {
    setSelectedVariation(variation);
    onSelectionChange?.({ scale: selectedScale, variation });
  };

  const handleQty = (delta: number) => {
    setQuantity((q) => Math.max(1, q + delta));
  };

  const handleAdd = async () => {
    if (!hasSelection) {
      setShakeStep2(true);
      setTimeout(() => setShakeStep2(false), 500);
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onAddToCart({
        scaleId: selectedScale?.id,
        variationId: selectedVariation?.id,
        quantity,
      });
      setAddedFlash(true);
      setTimeout(() => setAddedFlash(false), 1400);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      let safeMsg = "Không thể thêm vào giỏ hàng. Vui lòng thử lại sau.";
      if (status === 400)
        safeMsg = "Dữ liệu không hợp lệ. Vui lòng kiểm tra và thử lại.";
      else if (status === 401)
        safeMsg = "Phiên đã hết hạn. Vui lòng tải lại trang.";
      else if (status === 404) safeMsg = "Sản phẩm không có sẵn.";
      else if (status === 409) safeMsg = "Sản phẩm hết hàng.";
      else if (status === 429)
        safeMsg = "Thao tác quá nhiều. Vui lòng đợi một lát.";
      setErrorMessage(safeMsg);
      if (status == null || isReportableHttpStatus(status)) {
        reportError(
          {
            type: "http",
            message: "[PDP] add-to-cart failed",
            status,
            timestamp: Date.now(),
          },
          err,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const variantSuffix = [selectedScale?.name, selectedVariation?.name]
    .filter(Boolean)
    .join(" · ");

  const masculineLabels = ["phiên bản"];
  const labelLower = variationAxisLabel.toLowerCase();
  const article = masculineLabels.includes(labelLower) ? "một" : "một";
  const articleSing = article === "một" ? "phiên bản" : "phiên bản";

  return (
    <aside ref={ref} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {brand && (
            <Link
              href={`/products?brandId=${brand.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-magenta/45 bg-magenta/[0.08] px-3 py-1 font-display text-[11px] font-medium uppercase tracking-[0.1em] text-white transition hover:border-magenta hover:bg-magenta/[0.16]"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-magenta shadow-[0_0_8px_var(--magenta)]"
              />
              {brand.name}
            </Link>
          )}
          {isNsfw && (
            <span className="rounded-full border border-magenta/55 bg-magenta/15 px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.1em] text-magenta">
              CAO CẤP
            </span>
          )}
          {category &&
            (typeof category === "object" && category.slug ? (
              <Link
                href={`/c/${category.slug}`}
                className="rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/70 transition hover:border-cyan/45 hover:text-cyan"
              >
                {category.name}
              </Link>
            ) : (
              <Badge
                variant="outline"
                className="border-white/15 font-mono text-[10px] uppercase tracking-wider text-white/70"
              >
                {typeof category === "string" ? category : category.name}
              </Badge>
            ))}
        </div>
        <WishlistButton
          productId={productId}
          productSlug={productSlug}
          className="size-9 rounded-full border border-white/10 bg-transparent text-white/60 hover:border-cyan/45 hover:bg-transparent hover:text-cyan"
        />
      </div>

      <div>
        <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl">
          {productName}
        </h1>
        {productSubtitle && (
          <p className="mt-1 text-sm text-white/55">{productSubtitle}</p>
        )}
      </div>

      {(averageRating != null || reviewCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StarRating rating={averageRating ?? 0} />
          <span className="font-medium text-white">
            {(averageRating ?? 0).toFixed(1)}
          </span>
          <span className="text-white/40">·</span>
          <a href="#sec-rev" className="text-cyan hover:underline">
            {reviewCount} đánh giá
          </a>
          {reviewCount > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-lime">
              <Check className="size-3" /> Đã xác thực
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 border-y border-white/10 py-4">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/45">
          Giá
        </span>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-4xl font-extrabold text-white sm:text-5xl">
            {formatCurrency(pricing.price)}
          </span>
          {variantSuffix && (
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">
              · {variantSuffix}
            </span>
          )}
        </div>
        {pricing.hasDiscount && (
          <div className="text-sm text-white/45 line-through">
            {formatCurrency(pricing.regularPrice)}
          </div>
        )}
        {pricing.price > 0 && (
          <div className="mt-2 text-xs text-white/65">
            <b className="font-semibold text-cyan">QR</b> thanh toán{" "}
            <b className="font-semibold text-white">
              {formatCurrency(pricing.price)}
            </b>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {scales.length > 1 && (
          <StepBox
            num="01"
            label="Tỉ lệ"
            value={selectedScale?.name}
            isActive={selectedScale != null}
          >
            <div className="flex flex-wrap gap-2">
              {scales.map((scale) => {
                const baseScale = initialScale;
                const deltaPct =
                  scale.percentageIncrease -
                  (baseScale?.percentageIncrease ?? 0);

                const deltaValue = (deltaBasePrice * deltaPct) / 100;
                const delta =
                  deltaPct === 0 || deltaValue === 0
                    ? undefined
                    : `+ ${formatCurrency(deltaValue)}`;
                return (
                  <OptionChip
                    key={scale.id}
                    label={scale.name}
                    meta={scale.meta}
                    priceLabel={delta}
                    selected={selectedScale?.id === scale.id}
                    onClick={() => handleSelectScale(scale)}
                  />
                );
              })}
            </div>
          </StepBox>
        )}

        {requireVariation &&
          (() => {
            const variationPrices = variations.map(
              (v) => v.salePrice ?? v.price,
            );
            const allSame = variationPrices.every(
              (p) => p === variationPrices[0],
            );
            return (
              <StepBox
                num="02"
                label={variationAxisLabel}
                value={selectedVariation?.name}
                required={!selectedVariation}
                isActive={selectedVariation != null}
                shaking={shakeStep2}
              >
                <div className="flex flex-wrap gap-2">
                  {variations.map((v) => {
                    const priceLabel = allSame
                      ? undefined
                      : formatCurrency(v.salePrice ?? v.price);
                    return (
                      <OptionChip
                        key={v.id}
                        label={v.name}
                        meta={v.description}
                        priceLabel={priceLabel}
                        selected={selectedVariation?.id === v.id}
                        onClick={() => handleSelectVariation(v)}
                      />
                    );
                  })}
                </div>
              </StepBox>
            );
          })()}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex min-w-0 items-stretch gap-2">
          <div className="flex shrink-0 items-center rounded-full border border-white/10">
            <button
              type="button"
              onClick={() => handleQty(-1)}
              aria-label="Giảm số lượng"
              disabled={quantity <= 1}
              className="size-12 font-display text-lg text-white/70 transition hover:bg-cyan/[0.08] hover:text-cyan disabled:opacity-30"
            >
              −
            </button>
            <input
              readOnly
              value={quantity}
              aria-label="Số lượng"
              className="h-12 w-10 bg-transparent text-center font-display text-base text-white outline-none"
            />
            <button
              type="button"
              onClick={() => handleQty(1)}
              aria-label="Tăng số lượng"
              className="size-12 font-display text-lg text-white/70 transition hover:bg-cyan/[0.08] hover:text-cyan"
            >
              +
            </button>
          </div>

          <Button
            variant={hasSelection ? "neon" : "neon-locked"}
            size="pill-lg"
            onClick={handleAdd}
            disabled={!hasSelection || submitting}
            className="rounded-lg min-w-0 flex-1 px-4"
          >
            {addedFlash ? (
              <>
                <Check className="size-5 shrink-0" />
                <span className="truncate">Đã thêm vào giỏ hàng</span>
              </>
            ) : (
              <>
                <ShoppingCart className="size-5 shrink-0" />
                {hasSelection ? (
                  <>
                    <span className="min-w-0 truncate sm:hidden">
                      Thêm vào giỏ hàng
                    </span>
                    <span className="hidden min-w-0 truncate sm:inline">
                      Thêm vào giỏ hàng
                      {/* · {formatCurrency(pricing.price)} */}
                    </span>
                  </>
                ) : (
                  <span className="min-w-0 truncate">
                    {`Chọn ${article} ${labelLower}`}
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
        {!hasSelection && !errorMessage && (
          <p className="text-center font-mono text-[10px] uppercase tracking-wider text-magenta">
            ↑ chọn {articleSing} {labelLower} để thêm vào giỏ hàng
          </p>
        )}
        {hasSelection && !errorMessage && (
          <p className="text-center font-mono text-[10px] uppercase tracking-wider text-lime">
            ✓ Sẵn sàng để thêm
          </p>
        )}
        {errorMessage && (
          <p
            role="alert"
            className="rounded-md border border-magenta/40 bg-magenta/10 px-3 py-2 text-xs text-magenta"
          >
            {errorMessage}
          </p>
        )}
      </div>

      {/* <PdpShippingEstimate
        productId={productId}
        variationId={selectedVariation?.id}
        quantity={quantity}
      /> */}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-white/15 p-3 sm:grid-cols-2">
        <MicroTrust
          icon={<Package className="size-3.5" />}
          title="Đóng gói cẩn thận"
          subtitle="Giao hàng an toàn, không bị hư hại"
        />
        <MicroTrust
          icon={<ShieldCheck className="size-3.5" />}
          title="Bảo vệ giao dịch"
          subtitle="SSL · Mercado Pago · 100% an toàn"
        />
        <MicroTrust
          icon={<Clock className="size-3.5" />}
          title="Thời gian sản xuất"
          subtitle={`${productionDays} ngày làm việc trước khi giao hàng`}
        />
        <MicroTrust
          icon={<MessageCircle className="size-3.5" />}
          title="Hỗ trợ trực tiếp"
          subtitle="Dễ dàng liên hệ qua Zalo"
        />
      </div>
    </aside>
  );
});

interface StepBoxProps {
  num: string;
  label: string;
  value?: string;
  required?: boolean;
  isActive?: boolean;
  shaking?: boolean;
  children: React.ReactNode;
}

function StepBox({
  num,
  label,
  value,
  required,
  isActive,
  shaking,
  children,
}: StepBoxProps) {
  return (
    <div
      className={[
        "rounded-xl border bg-white/[0.015] px-5 py-4 transition-colors duration-[var(--dur-base)]",
        isActive ? "border-cyan/30" : "border-white/10",
        shaking ? "animate-shake-x" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-cyan">
          {`// ${num}`}
        </span>
        <span className="text-sm font-semibold uppercase tracking-wider text-white">
          {label}
        </span>
        {required ? (
          <span className="ml-auto rounded-full border border-magenta/45 bg-magenta/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-magenta">
            bắt buộc
          </span>
        ) : value ? (
          <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-cyan/85">
            {value}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

interface MicroTrustProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function MicroTrust({ icon, title, subtitle }: MicroTrustProps) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-cyan" aria-hidden>
        {icon}
      </span>
      <div className="text-[11px] leading-snug text-white/60">
        <b className="block font-medium text-white">{title}</b>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const clamped = Math.max(0, Math.min(5, rating));
  const pct = (clamped / 5) * 100;
  return (
    <span
      role="img"
      aria-label={`${clamped.toFixed(1)} 5 sao`}
      className="relative inline-flex items-center"
      style={{ width: size * 5 + 8, height: size }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center gap-0.5 text-white/20"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <StarSvg key={i} size={size} />
        ))}
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden text-gold"
        style={{ width: `${pct}%` }}
      >
        <span className="flex items-center gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <StarSvg key={i} size={size} />
          ))}
        </span>
      </span>
    </span>
  );
}

function StarSvg({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
