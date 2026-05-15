import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StorefrontProduct as Product } from '@/types/product';

const fbqMock = vi.fn();

beforeEach(() => {
  fbqMock.mockClear();
  (globalThis as { window?: unknown }).window = { fbq: fbqMock };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

import {
  trackMetaEvent,
  trackViewContent,
  trackAddToCart,
  trackAddToWishlist,
  trackInitiateCheckout,
  trackPurchase,
  trackSearch,
  type MetaCheckoutItem,
  type MetaPurchaseOrder,
} from './meta-pixel';

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

describe('trackMetaEvent', () => {
  it('forwards event_name and data to fbq with eventID option', () => {
    trackMetaEvent('CustomEvent', { foo: 'bar' }, 'evt-1');
    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'CustomEvent',
      { foo: 'bar' },
      { eventID: 'evt-1' },
    );
  });

  it('omits the options object when eventId not provided', () => {
    trackMetaEvent('CustomEvent', { foo: 'bar' });
    expect(fbqMock).toHaveBeenCalledWith('track', 'CustomEvent', { foo: 'bar' });
  });

  it('is a silent no-op when window.fbq is missing (ad-block / SSR)', () => {
    (globalThis as { window?: unknown }).window = {};
    expect(() => trackMetaEvent('CustomEvent', {}, 'id')).not.toThrow();
  });
});

describe('trackViewContent', () => {
  it('fires ViewContent with content_ids, value, currency', () => {
    trackViewContent(baseProduct);
    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'ViewContent',
      expect.objectContaining({
        content_ids: ['p1'],
        content_type: 'product',
        content_name: 'Elven Warrior',
        currency: 'VND',
        value: 49.9,
      }),
    );
  });

  it('uses salePrice when present', () => {
    trackViewContent({ ...baseProduct, salePrice: 39.9 });
    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'ViewContent',
      expect.objectContaining({ value: 39.9 }),
    );
  });
});

describe('trackAddToCart', () => {
  it('fires AddToCart with quantity and total value', () => {
    trackAddToCart(baseProduct, 3);
    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'AddToCart',
      expect.objectContaining({
        content_ids: ['p1'],
        content_type: 'product',
        currency: 'VND',
        value: 49.9 * 3,
      }),
    );
  });

  it('combines productId with variationId in content_ids', () => {
    trackAddToCart(baseProduct, 1, { variationId: 'v1', price: 59 });
    const call = fbqMock.mock.calls[0];
    expect(call[2]).toMatchObject({
      content_ids: ['p1-v1'],
      value: 59,
    });
  });
});

describe('trackAddToWishlist', () => {
  it('fires AddToWishlist with content_ids and value', () => {
    trackAddToWishlist(baseProduct);
    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'AddToWishlist',
      expect.objectContaining({
        content_ids: ['p1'],
        currency: 'VND',
        value: 49.9,
      }),
    );
  });
});

describe('trackInitiateCheckout', () => {
  const items: MetaCheckoutItem[] = [
    { productId: 'p1', name: 'X', price: 10, quantity: 2 },
    { productId: 'p2', variationId: 'v2', name: 'Y', price: 5, quantity: 1 },
  ];

  it('fires InitiateCheckout with all content_ids and num_items', () => {
    trackInitiateCheckout(items, 25);
    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'InitiateCheckout',
      expect.objectContaining({
        content_ids: ['p1', 'p2-v2'],
        contents: [
          { id: 'p1', quantity: 2 },
          { id: 'p2-v2', quantity: 1 },
        ],
        currency: 'VND',
        value: 25,
        num_items: 3,
      }),
    );
  });
});

describe('trackSearch', () => {
  it('fires Search with search_string', () => {
    trackSearch('elven');
    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'Search',
      expect.objectContaining({ search_string: 'elven' }),
    );
  });
});

describe('trackPurchase', () => {
  const order: MetaPurchaseOrder = {
    orderNumber: 'ORD-001234',
    value: 245.5,
    items: [
      { productId: 'prod1', name: 'Item A', price: 100, quantity: 2 },
      {
        productId: 'prod2',
        variationId: 'var1',
        name: 'Item B',
        price: 30,
        quantity: 1,
      },
    ],
  };

  it('fires Purchase with event_id = purchase_<orderNumber>', () => {
    trackPurchase(order);
    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'Purchase',
      expect.objectContaining({
        content_ids: ['prod1', 'prod2-var1'],
        currency: 'VND',
        value: 245.5,
        num_items: 3,
      }),
      { eventID: 'purchase_ORD-001234' },
    );
  });

  it('event_id format guarantees CAPI deduplication', () => {
    trackPurchase(order);
    const opts = fbqMock.mock.calls[0][3] as { eventID: string };
    expect(opts.eventID).toBe('purchase_ORD-001234');
  });
});
