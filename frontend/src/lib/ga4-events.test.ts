import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StorefrontProduct as Product } from '@/types/product';

const sendGAEventMock = vi.fn();
vi.mock('@next/third-parties/google', () => ({
  sendGAEvent: (...args: unknown[]) => sendGAEventMock(...args),
}));

import {
  buildGA4Item,
  trackViewItem,
  trackViewItemList,
  trackAddToCart,
  trackAddToWishlist,
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackPurchase,
  trackSearch,
  type GA4CheckoutItem,
} from './ga4-events';

const baseProduct: Product = {
  id: 'p1',
  name: 'Elven Warrior',
  slug: 'guerreira-elven',
  description: 'desc',
  basePrice: 49.9,
  isActive: true,
  featured: false,
  tags: [],
  images: [],
  variations: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('buildGA4Item', () => {
  it('should map a basic product to GA4 item shape', () => {
    const item = buildGA4Item(baseProduct, 2);
    expect(item).toMatchObject({
      item_id: 'p1',
      item_name: 'Elven Warrior',
      price: 49.9,
      quantity: 2,
      currency: 'VND',
    });
  });

  it('should default quantity to 1', () => {
    const item = buildGA4Item(baseProduct);
    expect(item.quantity).toBe(1);
  });

  it('should prefer salePrice when present', () => {
    const item = buildGA4Item({ ...baseProduct, salePrice: 39.9 }, 1);
    expect(item.price).toBe(39.9);
  });

  it('should include brand when present', () => {
    const item = buildGA4Item(
      { ...baseProduct, brand: { id: 'b1', name: 'Arsenal Craft', slug: 'arsenal' } },
      1,
    );
    expect(item.item_brand).toBe('Arsenal Craft');
  });

  it('should include category from primary productCategory', () => {
    const item = buildGA4Item(
      {
        ...baseProduct,
        productCategories: [
          {
            id: 'pc1',
            categoryId: 'c1',
            category: { id: 'c1', name: 'Fantasy', slug: 'fantasy' },
          },
        ],
      },
      1,
    );
    expect(item.item_category).toBe('Fantasy');
  });

  it('should include variation as variant', () => {
    const item = buildGA4Item(baseProduct, 1, {
      variationId: 'v1',
      variationName: 'Heroic Pose',
    });
    expect(item.item_variant).toBe('Heroic Pose');
    expect(item.item_id).toBe('p1-v1');
  });

  it('should override price when explicit price provided', () => {
    const item = buildGA4Item(baseProduct, 1, { price: 59.9 });
    expect(item.price).toBe(59.9);
  });
});

describe('trackers', () => {
  beforeEach(() => {
    sendGAEventMock.mockClear();
  });

  it('trackViewItem fires view_item with item array and value', () => {
    trackViewItem(baseProduct);
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'view_item', {
      currency: 'VND',
      value: 49.9,
      items: [expect.objectContaining({ item_id: 'p1', item_name: 'Elven Warrior' })],
    });
  });

  it('trackAddToCart fires add_to_cart with quantity and price', () => {
    trackAddToCart(baseProduct, 3, { price: 39.9 });
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'add_to_cart', {
      currency: 'VND',
      value: 39.9 * 3,
      items: [expect.objectContaining({ item_id: 'p1', quantity: 3, price: 39.9 })],
    });
  });

  it('trackAddToWishlist fires add_to_wishlist event', () => {
    trackAddToWishlist(baseProduct);
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'add_to_wishlist', {
      currency: 'VND',
      value: 49.9,
      items: [expect.objectContaining({ item_id: 'p1' })],
    });
  });

  it('trackBeginCheckout fires begin_checkout with all items', () => {
    const items: GA4CheckoutItem[] = [
      { productId: 'p1', name: 'Item 1', price: 10, quantity: 2 },
      { productId: 'p2', name: 'Item 2', price: 5, quantity: 1 },
    ];
    trackBeginCheckout(items, 25);
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'begin_checkout', {
      currency: 'VND',
      value: 25,
      items: [
        expect.objectContaining({ item_id: 'p1', item_name: 'Item 1', quantity: 2, price: 10 }),
        expect.objectContaining({ item_id: 'p2', item_name: 'Item 2', quantity: 1, price: 5 }),
      ],
    });
  });

  it('trackAddShippingInfo fires add_shipping_info with shipping_tier', () => {
    const items: GA4CheckoutItem[] = [{ productId: 'p1', name: 'X', price: 10, quantity: 1 }];
    trackAddShippingInfo(items, 25, 'PAC');
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'add_shipping_info', {
      currency: 'VND',
      value: 25,
      shipping_tier: 'PAC',
      items: expect.any(Array),
    });
  });


  it('trackPurchase fires purchase with transaction_id, value, tax, shipping', () => {
    const items: GA4CheckoutItem[] = [{ productId: 'p1', name: 'X', price: 10, quantity: 2 }];
    trackPurchase({
      transactionId: 'ORD-123456',
      items,
      value: 30,
      shipping: 10,
      coupon: 'PROMO10',
    });
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'purchase', {
      transaction_id: 'ORD-123456',
      currency: 'VND',
      value: 30,
      shipping: 10,
      coupon: 'PROMO10',
      items: expect.any(Array),
    });
  });

  it('trackViewItemList fires view_item_list with list id/name and items', () => {
    const products = [
      baseProduct,
      { ...baseProduct, id: 'p2', name: 'Other mini' },
    ];
    trackViewItemList(products, {
      listId: 'category-fantasy',
      listName: 'Fantasy',
    });
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'view_item_list', {
      item_list_id: 'category-fantasy',
      item_list_name: 'Fantasy',
      items: [
        expect.objectContaining({ item_id: 'p1' }),
        expect.objectContaining({ item_id: 'p2', item_name: 'Other mini' }),
      ],
    });
  });

  it('trackViewItemList is a no-op when items are empty', () => {
    trackViewItemList([], { listId: 'empty', listName: 'Empty' });
    expect(sendGAEventMock).not.toHaveBeenCalled();
  });

  it('trackSearch fires search event with search_term', () => {
    trackSearch('elven');
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'search', {
      search_term: 'elven',
    });
  });
});
