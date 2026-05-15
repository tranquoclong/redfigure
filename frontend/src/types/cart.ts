export interface BundleCartChild {
  productId: string;
  productSlug?: string;
  variationId?: string;
  variationName?: string;
  quantity: number;
  unitPrice: number;
  discountedPrice: number;
  name: string;
  image?: string;
}

export interface CartItem {
  productId?: string;
  variationId?: string;
  variationLabel?: string;
  variationName?: string;
  scaleId?: string;
  scaleName?: string;
  scalePercentage?: number;

  quoteItemId?: string;
  quoteToken?: string;
  customItemDescription?: string;
  quantity: number;
  price: number;
  name: string;
  image?: string;

  productSlug?: string;
  brandName?: string;

  bundleDiscount?: number;
  bundleChildren?: BundleCartChild[];

  isFreeGift?: boolean;
  freeGiftId?: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
}

export interface RevalidatedCartItem extends CartItem {
  availableStock: number | null;
  outOfStock: boolean;
  currentPrice: number | null;
  priceChanged: boolean;
  priceChangedDelta: number;

  productionDays: number | null;

  brandId: string | null;

  brandName: string | undefined;

  productSlug: string | undefined;
}

export interface RevalidatedCart {
  items: RevalidatedCartItem[];
  subtotal: number;
}
