'use client';

import { useMemo } from 'react';

export interface PdpScaleItem {
  id: string;
  name: string;
  percentageIncrease: number;
  sortOrder?: number;
}

export interface PdpVariation {
  id: string;
  price: number;
  salePrice?: number | null;
}

export interface UsePdpPricingArgs {
  basePrice: number;
  baseSalePrice?: number | null;
  selectedVariation?: PdpVariation | null;
  selectedScale?: PdpScaleItem | null;
  availableVariations?: PdpVariation[];
}

export interface UsePdpPricingResult {
  price: number;
  regularPrice: number;
  hasDiscount: boolean;
  deltaFromBase: number;
}

export function usePdpPricing({
  basePrice,
  baseSalePrice,
  selectedVariation,
  selectedScale,
  availableVariations,
}: UsePdpPricingArgs): UsePdpPricingResult {
  return useMemo(() => {

    const variationsList = availableVariations ?? [];
    const hasVariations = variationsList.length > 0;
    let minVariationPrice: number | null = null;
    let minVariationRegular: number | null = null;
    if (hasVariations) {
      const effectivePrices = variationsList.map(
        (v) => v.salePrice ?? v.price,
      );
      const regularPrices = variationsList.map((v) => v.price);
      minVariationPrice = Math.min(...effectivePrices);
      minVariationRegular = Math.min(...regularPrices);
    }

    const variationRegular =
      selectedVariation?.price ?? minVariationRegular ?? basePrice;
    const variationSale =
      selectedVariation?.salePrice ??
      (selectedVariation
        ? null
        : minVariationPrice != null &&
          minVariationRegular != null &&
          minVariationPrice < minVariationRegular
          ? minVariationPrice
          : (baseSalePrice ?? null));

    const baseForCalc = variationSale ?? variationRegular;
    const pct = selectedScale?.percentageIncrease ?? 0;
    const multiplier = 1 + pct / 100;

    const price = roundCents(baseForCalc * multiplier);
    const regularPrice = roundCents(variationRegular * multiplier);

    return {
      price,
      regularPrice,
      hasDiscount: variationSale != null && variationSale < variationRegular,
      deltaFromBase: roundCents(price - basePrice),
    };
  }, [
    basePrice,
    baseSalePrice,
    availableVariations,
    selectedVariation,
    selectedScale,
  ]);
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
