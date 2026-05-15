import { it } from 'node:test';
import { computeBaseAmount } from './affiliate-commission-math';

describe('computeBaseAmount — pro-rata coupon distribution', () => {
  function makeItem(overrides: Partial<any> = {}) {
    return {
      id: 'i1',
      productId: 'p1',
      quantity: 1,
      price: 100,
      discount: 0,
      ...overrides,
    };
  }

  describe('without coupon', () => {
    it('returns item.price * qty (without discount)', () => {
      const item = makeItem({ price: 100, quantity: 2 });
      const base = computeBaseAmount({
        item,
        allItems: [item],
        itemsInScope: [item],
        couponDiscount: 0,
      });
      expect(base).toBe(200);
    });

    it('subtracts item.discount (bundle discount, etc)', () => {
      const item = makeItem({ price: 100, quantity: 1, discount: 10 });
      const base = computeBaseAmount({
        item,
        allItems: [item],
        itemsInScope: [item],
        couponDiscount: 0,
      });
      expect(base).toBe(90);
    });
  });

  describe('cart-wide coupon (scope = ALL items)', () => {
    it('distributes discount proportionally between items', () => {
      const a = makeItem({ id: 'a', price: 100, quantity: 1 });
      const b = makeItem({ id: 'b', price: 200, quantity: 1 });

      const ctx = {
        allItems: [a, b],
        itemsInScope: [a, b],
        couponDiscount: 30,
      };
      expect(computeBaseAmount({ ...ctx, item: a })).toBeCloseTo(90, 2);
      expect(computeBaseAmount({ ...ctx, item: b })).toBeCloseTo(180, 2);
    });

    it('sum of baseAmounts matches subtotal-discount (sanity)', () => {
      const a = makeItem({ id: 'a', price: 100 });
      const b = makeItem({ id: 'b', price: 200 });
      const c = makeItem({ id: 'c', price: 50 });
      const ctx = {
        allItems: [a, b, c],
        itemsInScope: [a, b, c],
        couponDiscount: 35,
      };
      const sum =
        computeBaseAmount({ ...ctx, item: a }) +
        computeBaseAmount({ ...ctx, item: b }) +
        computeBaseAmount({ ...ctx, item: c });
      expect(sum).toBeCloseTo(315, 2);
    });
  });

  describe('coupon with category/tag restriction (partial scope)', () => {
    it('item outside the scope maintains full price', () => {
      const covered = makeItem({ id: 'c', price: 100, productId: 'p-covered' });
      const out = makeItem({ id: 'o', price: 50, productId: 'p-out' });
      const base = computeBaseAmount({
        item: out,
        allItems: [covered, out],
        itemsInScope: [covered],
        couponDiscount: 20,
      });
      expect(base).toBe(50);
    });

    it('covered item receives the TOTAL discount (unique item in scope)', () => {
      const covered = makeItem({ id: 'c', price: 100, productId: 'p-covered' });
      const out = makeItem({ id: 'o', price: 50, productId: 'p-out' });
      const base = computeBaseAmount({
        item: covered,
        allItems: [covered, out],
        itemsInScope: [covered],
        couponDiscount: 20,
      });
      expect(base).toBe(80);
    });

    it('two items in scope: pro-rata only between them', () => {
      const a = makeItem({ id: 'a', price: 100 });
      const b = makeItem({ id: 'b', price: 300 });
      const out = makeItem({ id: 'o', price: 500 });

      const ctx = {
        allItems: [a, b, out],
        itemsInScope: [a, b],
        couponDiscount: 40,
      };
      expect(computeBaseAmount({ ...ctx, item: a })).toBeCloseTo(90, 2);
      expect(computeBaseAmount({ ...ctx, item: b })).toBeCloseTo(270, 2);
      expect(computeBaseAmount({ ...ctx, item: out })).toBe(500);
    });
  });

  describe('edge cases', () => {
    it('couponDiscount=0 + full scope → full price', () => {
      const a = makeItem({ price: 100 });
      expect(
        computeBaseAmount({
          item: a,
          allItems: [a],
          itemsInScope: [a],
          couponDiscount: 0,
        }),
      ).toBe(100);
    });

    it('item with quantity>1 and partial scope: full price', () => {
      const a = makeItem({ price: 50, quantity: 3 });
      const out = makeItem({ id: 'o', price: 100 });
      expect(
        computeBaseAmount({
          item: a,
          allItems: [a, out],
          itemsInScope: [out],
          couponDiscount: 20,
        }),
      ).toBe(150);
    });

    it('empty scope + active coupon: base returns full price (does not divide by 0)', () => {
      const a = makeItem({ price: 100 });
      const base = computeBaseAmount({
        item: a,
        allItems: [a],
        itemsInScope: [],
        couponDiscount: 50,
      });

      expect(base).toBe(100);
    });

    it('baseAmount NEVER negative even if discount > subtotal do scope (bug setting)', () => {
      const a = makeItem({ price: 10 });
      const base = computeBaseAmount({
        item: a,
        allItems: [a],
        itemsInScope: [a],
        couponDiscount: 50,
      });
      expect(base).toBeGreaterThanOrEqual(0);
    });
  });
});
