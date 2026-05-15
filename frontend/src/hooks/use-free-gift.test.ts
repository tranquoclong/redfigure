import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useFreeGift } from './use-free-gift';
import { useCartStore } from '@/store/cart-store';
import { api } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  api: { get: vi.fn() },
}));

const mockedApiGet = vi.mocked(api.get);

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    children,
  );
}

describe('useFreeGift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.setState({ items: [], subtotal: 0, itemCount: 0 });
  });

  it('returns neutral state when there is no active gift', async () => {
    mockedApiGet.mockResolvedValue({ data: { data: null } });
    const { result } = renderHook(() => useFreeGift(), { wrapper });
    await waitFor(() => {
      expect(result.current.activeGift).toBeNull();
    });
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.amountLeft).toBe(0);
    expect(result.current.progress).toBe(0);
  });

  it('calculates progress and amountLeft with subtotal below minimum', async () => {
    mockedApiGet.mockResolvedValue({
      data: {
        data: {
          id: 'g1',
          minOrderAmount: 100,
          label: '🎁 Gift',
          product: { id: 'p1', name: 'Gift', slug: 'gift' },
        },
      },
    });
    useCartStore.setState({
      items: [
        {
          productId: 'p2',
          quantity: 1,
          price: 60,
          name: 'X',
        },
      ],
      subtotal: 60,
      itemCount: 1,
    });
    const { result } = renderHook(() => useFreeGift(), { wrapper });
    await waitFor(() => {
      expect(result.current.activeGift?.id).toBe('g1');
    });
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.amountLeft).toBe(40);
    expect(result.current.progress).toBe(60);
  });

  it('marks isUnlocked=true when subtotal reaches minimum', async () => {
    mockedApiGet.mockResolvedValue({
      data: {
        data: {
          id: 'g1',
          minOrderAmount: 100,
          label: '🎁 Gift',
          product: { id: 'p1', name: 'Gift', slug: 'gift' },
        },
      },
    });
    useCartStore.setState({
      items: [
        { productId: 'p2', quantity: 2, price: 60, name: 'X' },
      ],
      subtotal: 120,
      itemCount: 2,
    });
    const { result } = renderHook(() => useFreeGift(), { wrapper });
    await waitFor(() => {
      expect(result.current.isUnlocked).toBe(true);
    });
    expect(result.current.amountLeft).toBe(0);
    expect(result.current.progress).toBe(100);
  });

  it('excludes gift items from subtotal calculation', async () => {
    mockedApiGet.mockResolvedValue({
      data: {
        data: {
          id: 'g1',
          minOrderAmount: 100,
          label: '🎁 Gift',
          product: { id: 'pgift', name: 'Gift', slug: 'gift' },
        },
      },
    });
    useCartStore.setState({
      items: [
        { productId: 'p2', quantity: 1, price: 110, name: 'X' },

        {
          productId: 'pgift',
          quantity: 1,
          price: 0,
          name: 'Gift',
          isFreeGift: true,
          freeGiftId: 'g1',
        },
      ],
      subtotal: 110,
      itemCount: 2,
    });
    const { result } = renderHook(() => useFreeGift(), { wrapper });
    await waitFor(() => {
      expect(result.current.activeGift).not.toBeNull();
    });
    expect(result.current.isUnlocked).toBe(true);

    expect(result.current.amountLeft).toBe(0);
  });
});
