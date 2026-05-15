export interface PricingInput {
  userId: string;
  userEmail?: string;
  items: Array<{

    productId?: string;
    variationId?: string;
    scaleId?: string;
    quoteItemId?: string;
    quantity: number;

    isFreeGift?: boolean;

    freeGiftId?: string;
  }>;

  couponCodes?: string[];
  shippingAmount: number;
  shippingZipCode?: string;

  shippingServiceId?: number;
  paymentMethod?: string;
}

export interface BundleComponentSnapshot {
  childProductId: string;
  childVariationId?: string;
  quantity: number;
  unitPrice: number;
  discountedPrice: number;
  productName: string;
  productImage?: string;
}

export interface VerifiedItem {
  productId?: string;
  variationId?: string;
  scaleId?: string;
  quoteItemId?: string;
  quantity: number;
  basePrice: number;
  scalePercentage: number;
  unitPrice: number;
  lineTotal: number;

  variationLabel?: string;
  variationName?: string;
  scaleName?: string;

  customItemName?: string;
  customItemDescription?: string;

  customWeight?: number;
  customWidth?: number;
  customHeight?: number;
  customLength?: number;

  bundleComponents?: BundleComponentSnapshot[];
  bundleDiscount?: number;

  isFreeGift?: boolean;

  freeGiftId?: string;
}

export interface AppliedCoupon {
  couponId: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING' | string;
  discount: number;
  isFreeShipping: boolean;
}

export interface CouponsResult {
  applied: AppliedCoupon[];
  totalDiscount: number;
  isFreeShipping: boolean;
}

export interface PricingResult {
  items: VerifiedItem[];
  subtotal: number;
  couponDiscount: number;

  appliedCoupons: AppliedCoupon[];
  isFreeShipping: boolean;
  shipping: number;
  paymentDiscount: number;
  total: number;
}
