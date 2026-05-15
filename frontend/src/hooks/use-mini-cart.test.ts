import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMiniCart } from './use-mini-cart';
import { useCartStore } from '@/store/cart-store';

describe('useMiniCart', () => {
  beforeEach(() => {
    useMiniCart.setState({ open: false });
    useCartStore.setState({ items: [], subtotal: 0, itemCount: 0 });
  });

  it('starts closed', () => {
    const { result } = renderHook(() => useMiniCart());
    expect(result.current.open).toBe(false);
  });

  it('openCart opens the drawer', () => {
    const { result } = renderHook(() => useMiniCart());
    act(() => {
      result.current.openCart();
    });
    expect(result.current.open).toBe(true);
  });

  it('closeCart closes the drawer', () => {
    const { result } = renderHook(() => useMiniCart());
    act(() => {
      result.current.openCart();
      result.current.closeCart();
    });
    expect(result.current.open).toBe(false);
  });

  it('setOpen accepts boolean', () => {
    const { result } = renderHook(() => useMiniCart());
    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.setOpen(false);
    });
    expect(result.current.open).toBe(false);
  });

  it('toggle alternates the state', () => {
    const { result } = renderHook(() => useMiniCart());
    act(() => {
      result.current.toggle();
    });
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.open).toBe(false);
  });

  it('REGRESSION: itemCount change DOES NOT open the drawer automatically', () => {
    const { result: miniCart } = renderHook(() => useMiniCart());
    expect(miniCart.current.open).toBe(false);

    act(() => {
      useCartStore.setState({
        items: [
          {
            productId: 'p1',
            name: 'Product',
            quantity: 1,
            price: 100,
          } as never,
        ],
        subtotal: 100,
        itemCount: 1,
      });
    });

    expect(miniCart.current.open).toBe(false);
  });
});
