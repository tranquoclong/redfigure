import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePdpPricing } from './use-pdp-pricing';

describe('usePdpPricing', () => {
  it('without variation and without scale — uses raw basePrice', () => {
    const { result } = renderHook(() =>
      usePdpPricing({ basePrice: 100, baseSalePrice: null }),
    );
    expect(result.current.price).toBe(100);
    expect(result.current.regularPrice).toBe(100);
    expect(result.current.deltaFromBase).toBe(0);
    expect(result.current.hasDiscount).toBe(false);
  });

  it('applies +80% scale over variation price', () => {
    const { result } = renderHook(() =>
      usePdpPricing({
        basePrice: 100,
        selectedVariation: { id: 'v1', price: 200, salePrice: null },
        selectedScale: {
          id: 's1',
          name: '75mm',
          percentageIncrease: 80,
        },
      }),
    );

    expect(result.current.price).toBe(360);
    expect(result.current.deltaFromBase).toBe(260);
  });

  it('variation salePrice has precedence over regular price', () => {
    const { result } = renderHook(() =>
      usePdpPricing({
        basePrice: 100,
        selectedVariation: { id: 'v1', price: 250, salePrice: 200 },
        selectedScale: { id: 's1', name: '32mm', percentageIncrease: 0 },
      }),
    );
    expect(result.current.price).toBe(200);
    expect(result.current.regularPrice).toBe(250);
    expect(result.current.hasDiscount).toBe(true);
  });

  it('rounding to 2 decimal places avoids float drift', () => {
    const { result } = renderHook(() =>
      usePdpPricing({
        basePrice: 99.99,
        selectedScale: { id: 's', name: 'x', percentageIncrease: 33 },
      }),
    );

    expect(result.current.price).toBe(132.99);
  });
});
