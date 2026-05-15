"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ProductGallery } from "@/components/product/product-gallery";
import {
  ProductPurchasePanel,
  type PurchaseScaleItem,
  type PurchaseVariation,
} from "@/components/product/product-purchase-panel";
import { StickyBottomCta } from "@/components/product/sticky-bottom-cta";
import { useStickyCta } from "@/hooks/use-sticky-cta";
import { useCart } from "@/hooks/use-cart";
import { resolveCaption } from "@/types/product";
import type { Product, ProductImage } from "@/types/product";

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

interface Variation {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  image?: string;
  stock: number;
  images?: Array<{
    id: string;
    mediaFileId: string;
    mediaFile?: {
      id: string;
      thumb: string;
      card: string;
      gallery: string;
      full: string;
      alt?: string;
      caption?: string | null;
      captionPreset?: { text: string } | null;
    };
    order: number;
    isMain: boolean;
  }>;
  attributeValue?: {
    id: string;
    value: string;
    attribute: { id: string; name: string };
  } | null;
}

interface BrandLite {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  productsCount?: number;
}

interface Props {
  product: Product;
  images: ProductImage[];
  variations: Variation[];
  scaleData: ScaleData | null;
  brand?: BrandLite | null;
  averageRating?: number;
  reviewCount?: number;
  productionDays?: number;
  isNsfw?: boolean;
  category?: { name: string; slug?: string } | null;
}

export function ProductMain({
  product,
  images,
  variations,
  scaleData,
  brand,
  averageRating,
  reviewCount = 0,
  productionDays = 6,
  isNsfw = false,
  category,
}: Props) {
  const {
    ref: panelRef,
    getNode: getPanelNode,
    isVisible: panelVisible,
  } = useStickyCta<HTMLDivElement>();

  const variationLabel = useMemo(() => {
    const first = variations.find((v) => v.attributeValue?.attribute?.name);
    return first?.attributeValue?.attribute?.name ?? "Phiên bản";
  }, [variations]);

  const scales: PurchaseScaleItem[] = useMemo(
    () =>
      scaleData?.items.map((s) => ({
        id: s.id,
        name: s.name,
        percentageIncrease: s.percentageIncrease,
        sortOrder: s.sortOrder,
      })) ?? [],
    [scaleData],
  );

  const purchaseVariations: PurchaseVariation[] = useMemo(
    () =>
      variations.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        salePrice: v.salePrice,
        description: v.attributeValue?.value,
      })),
    [variations],
  );

  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(
    null,
  );
  const [selectedScaleId, setSelectedScaleId] = useState<string | null>(
    scaleData?.items.find((s) => s.percentageIncrease === 0)?.id ??
      scaleData?.items[0]?.id ??
      null,
  );
  const selectedVariation = variations.find(
    (v) => v.id === selectedVariationId,
  );
  const selectedScale = scaleData?.items.find((s) => s.id === selectedScaleId);

  const galleryImages = useMemo(() => {
    if (selectedVariation?.images?.length) {
      return [...selectedVariation.images]
        .sort((a, b) => {
          if (a.isMain && !b.isMain) return -1;
          if (!a.isMain && b.isMain) return 1;
          return a.order - b.order;
        })
        .map((vi) => ({
          src: vi.mediaFile?.gallery ?? "",
          alt: vi.mediaFile?.alt ?? selectedVariation.name,

          caption: resolveCaption(vi.mediaFile),
        }));
    }
    return images.map((img) => ({
      src: img.mediaFile?.gallery ?? img.url ?? "",
      alt: img.altText ?? product.name,
      caption: resolveCaption(img.mediaFile),
    }));
  }, [images, selectedVariation, product.name]);

  const { addItem } = useCart();
  const router = useRouter();

  async function handleAddToCart(payload: {
    scaleId?: string;
    variationId?: string;
    quantity: number;
  }) {
    await addItem(
      product.id,
      payload.quantity,
      payload.variationId,
      payload.scaleId,
    );

    const variation = variations.find((v) => v.id === payload.variationId);
    const scale = scaleData?.items.find((s) => s.id === payload.scaleId);
    const variationPrice =
      variation?.salePrice ??
      variation?.price ??
      product.salePrice ??
      product.basePrice;
    const scaleMultiplier = scale
      ? 1 + (scale.percentageIncrease ?? 0) / 100
      : 1;
    const finalPrice = Math.round(variationPrice * scaleMultiplier * 100) / 100;
    const params = new URLSearchParams();
    if (variation) {
      params.set("variationLabel", variationLabel);
      params.set("variation", variation.name);
    }
    if (scale) params.set("scale", scale.name);
    params.set("price", String(finalPrice));
    router.push(`/p/${product.slug}/cart?${params.toString()}`);
  }

  const stickyThumb =
    selectedVariation?.images?.[0]?.mediaFile?.thumb ??
    images[0]?.mediaFile?.thumb ??
    images[0]?.url ??
    "";

  const variantSuffix = [
    selectedScale?.name,
    selectedVariation ? `${variationLabel}: ${selectedVariation.name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="grid gap-6 md:gap-8 lg:grid-cols-[1fr_460px]">
        <div className="lg:sticky lg:top-[92px] lg:self-start">
          <ProductGallery
            images={galleryImages}
            isNsfw={isNsfw}
            categoryLabel={category?.name}
          />
        </div>

        <ProductPurchasePanel
          ref={panelRef}
          productName={product.name}
          productSubtitle={
            brand
              ? `${brand.name}${
                  product.shortDescription
                    ? ` · ${product.shortDescription}`
                    : ""
                }`
              : (product.shortDescription ?? undefined)
          }
          basePrice={product.basePrice}
          baseSalePrice={product.salePrice}
          brand={brand ?? undefined}
          isNsfw={isNsfw}
          category={category ?? undefined}
          averageRating={averageRating}
          reviewCount={reviewCount}
          scales={scales}
          variations={purchaseVariations}
          variationAxisLabel={variationLabel}
          productionDays={productionDays}
          productId={product.id}
          productSlug={product.slug}
          onAddToCart={handleAddToCart}
          onSelectionChange={({ variation, scale }) => {
            setSelectedVariationId(variation?.id ?? null);
            setSelectedScaleId(scale?.id ?? null);
          }}
        />
      </div>

      <StickyBottomCta
        show={!panelVisible}
        thumbnail={stickyThumb}
        productName={product.name}
        variantSuffix={variantSuffix}
        price={
          selectedVariation?.salePrice ??
          selectedVariation?.price ??
          product.salePrice ??
          product.basePrice
        }
        ctaLabel="Thêm vào giỏ hàng"
        ctaDisabled={variations.length > 0 && !selectedVariation}
        onCtaClick={() => {
          const node = getPanelNode();
          if (!node) return;

          const reduceMotion =
            typeof window !== "undefined"
              ? (window.matchMedia?.("(prefers-reduced-motion: reduce)")
                  .matches ?? false)
              : false;
          node.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "center",
          });
        }}
      />
    </>
  );
}
