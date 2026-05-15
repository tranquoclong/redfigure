

import type { StorefrontProduct as Product } from '@/types/product';

const CURRENCY = 'VND';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export interface MetaCheckoutItem {
  productId: string;
  variationId?: string;
  name: string;
  price: number;
  quantity: number;
}

export interface MetaPurchaseOrder {
  orderNumber: string;
  value: number;
  items: MetaCheckoutItem[];
}

interface BuildOptions {
  variationId?: string;

  price?: number;
}

export function trackMetaEvent(
  eventName: string,
  data: Record<string, unknown>,
  eventId?: string,
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  if (eventId) {
    window.fbq('track', eventName, data, { eventID: eventId });
  } else {
    window.fbq('track', eventName, data);
  }
}

function contentIdFor(productId: string, variationId?: string): string {
  return variationId ? `${productId}-${variationId}` : productId;
}

function checkoutItemContentId(item: MetaCheckoutItem): string {
  return contentIdFor(item.productId, item.variationId);
}

export function trackViewContent(product: Product): void {
  const price = product.salePrice ?? product.basePrice;
  trackMetaEvent('ViewContent', {
    content_ids: [product.id],
    content_type: 'product',
    content_name: product.name,
    currency: CURRENCY,
    value: price,
  });
}

export function trackAddToCart(
  product: Product,
  quantity: number,
  options: BuildOptions = {},
): void {
  const unitPrice = options.price ?? product.salePrice ?? product.basePrice;
  trackMetaEvent('AddToCart', {
    content_ids: [contentIdFor(product.id, options.variationId)],
    content_type: 'product',
    content_name: product.name,
    currency: CURRENCY,
    value: unitPrice * quantity,
  });
}

export function trackAddToWishlist(product: Product): void {
  const price = product.salePrice ?? product.basePrice;
  trackMetaEvent('AddToWishlist', {
    content_ids: [product.id],
    content_type: 'product',
    content_name: product.name,
    currency: CURRENCY,
    value: price,
  });
}

export function trackInitiateCheckout(
  items: MetaCheckoutItem[],
  value: number,
): void {
  const numItems = items.reduce((sum, it) => sum + it.quantity, 0);
  trackMetaEvent('InitiateCheckout', {
    content_ids: items.map(checkoutItemContentId),
    content_type: 'product',
    contents: items.map((it) => ({
      id: checkoutItemContentId(it),
      quantity: it.quantity,
    })),
    currency: CURRENCY,
    value,
    num_items: numItems,
  });
}

export function trackSearch(searchString: string): void {
  trackMetaEvent('Search', { search_string: searchString });
}

export function trackPurchase(order: MetaPurchaseOrder): void {
  const numItems = order.items.reduce((sum, it) => sum + it.quantity, 0);
  trackMetaEvent(
    'Purchase',
    {
      content_ids: order.items.map(checkoutItemContentId),
      content_type: 'product',
      contents: order.items.map((it) => ({
        id: checkoutItemContentId(it),
        quantity: it.quantity,
      })),
      currency: CURRENCY,
      value: order.value,
      num_items: numItems,
    },
    `purchase_${order.orderNumber}`,
  );
}
