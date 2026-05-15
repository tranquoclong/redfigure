import { sendGAEvent } from '@next/third-parties/google';

import type { StorefrontProduct as Product } from '@/types/product';

const CURRENCY = 'VND';

export interface GA4Item {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  currency: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
}

export interface GA4CheckoutItem {
  productId: string;
  variationId?: string;
  variationName?: string;
  name: string;
  price: number;
  quantity: number;
  brand?: string;
  category?: string;
}

interface BuildItemOptions {
  variationId?: string;
  variationName?: string;

  price?: number;
}

export function buildGA4Item(
  product: Product,
  quantity: number = 1,
  options: BuildItemOptions = {},
): GA4Item {
  const effectivePrice =
    options.price ?? product.salePrice ?? product.basePrice;

  const primaryCategory =
    product.productCategories?.[0]?.category?.name ??
    product.category?.name;

  const item: GA4Item = {
    item_id: options.variationId ? `${product.id}-${options.variationId}` : product.id,
    item_name: product.name,
    price: effectivePrice,
    quantity,
    currency: CURRENCY,
  };

  if (product.brand?.name) item.item_brand = product.brand.name;
  if (primaryCategory) item.item_category = primaryCategory;
  if (options.variationName) item.item_variant = options.variationName;

  return item;
}

function checkoutItemToGA4(ci: GA4CheckoutItem): GA4Item {
  const item: GA4Item = {
    item_id: ci.variationId ? `${ci.productId}-${ci.variationId}` : ci.productId,
    item_name: ci.name,
    price: ci.price,
    quantity: ci.quantity,
    currency: CURRENCY,
  };
  if (ci.brand) item.item_brand = ci.brand;
  if (ci.category) item.item_category = ci.category;
  if (ci.variationName) item.item_variant = ci.variationName;
  return item;
}

export function trackViewItem(product: Product): void {
  const item = buildGA4Item(product, 1);
  sendGAEvent('event', 'view_item', {
    currency: CURRENCY,
    value: item.price,
    items: [item],
  });
}

export function trackViewItemList(
  products: Product[],
  list: { listId: string; listName: string },
): void {
  if (!products.length) return;
  sendGAEvent('event', 'view_item_list', {
    item_list_id: list.listId,
    item_list_name: list.listName,
    items: products.map((p) => buildGA4Item(p, 1)),
  });
}

export function trackAddToCart(
  product: Product,
  quantity: number,
  options: BuildItemOptions = {},
): void {
  const item = buildGA4Item(product, quantity, options);
  sendGAEvent('event', 'add_to_cart', {
    currency: CURRENCY,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackAddToWishlist(product: Product): void {
  const item = buildGA4Item(product, 1);
  sendGAEvent('event', 'add_to_wishlist', {
    currency: CURRENCY,
    value: item.price,
    items: [item],
  });
}

export function trackRemoveFromCart(item: GA4CheckoutItem): void {
  const ga4Item = checkoutItemToGA4(item);
  sendGAEvent('event', 'remove_from_cart', {
    currency: CURRENCY,
    value: ga4Item.price * ga4Item.quantity,
    items: [ga4Item],
  });
}

export function trackBeginCheckout(
  items: GA4CheckoutItem[],
  value: number,
): void {
  sendGAEvent('event', 'begin_checkout', {
    currency: CURRENCY,
    value,
    items: items.map(checkoutItemToGA4),
  });
}

export function trackAddShippingInfo(
  items: GA4CheckoutItem[],
  value: number,
  shippingTier: string,
): void {
  sendGAEvent('event', 'add_shipping_info', {
    currency: CURRENCY,
    value,
    shipping_tier: shippingTier,
    items: items.map(checkoutItemToGA4),
  });
}

export function trackAddPaymentInfo(
  items: GA4CheckoutItem[],
  value: number,
  paymentType: string,
): void {
  sendGAEvent('event', 'add_payment_info', {
    currency: CURRENCY,
    value,
    payment_type: paymentType,
    items: items.map(checkoutItemToGA4),
  });
}

export interface PurchaseParams {
  transactionId: string;
  items: GA4CheckoutItem[];
  value: number;
  shipping?: number;
  tax?: number;
  coupon?: string;
}

export function trackPurchase(params: PurchaseParams): void {
  const payload: Record<string, unknown> = {
    transaction_id: params.transactionId,
    currency: CURRENCY,
    value: params.value,
    items: params.items.map(checkoutItemToGA4),
  };
  if (params.shipping !== undefined) payload.shipping = params.shipping;
  if (params.tax !== undefined) payload.tax = params.tax;
  if (params.coupon) payload.coupon = params.coupon;
  sendGAEvent('event', 'purchase', payload);
}

export function trackSearch(searchTerm: string): void {
  sendGAEvent('event', 'search', { search_term: searchTerm });
}
