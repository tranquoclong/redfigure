'use client';

import { useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { api } from '@/lib/api-client';

export function useCart() {
  const { items, subtotal, itemCount, setCart, clear } = useCartStore();

  const fetchCart = useCallback(async () => {
    try {
      const { data } = await api.get('/cart');
      setCart(data.data.items, data.data.subtotal);
    } catch {}
  }, [setCart]);

  const addItem = useCallback(
    async (productId: string, quantity = 1, variationId?: string, scaleId?: string) => {
      const { data } = await api.post('/cart/items', {
        productId,
        quantity,
        variationId,
        scaleId,
      });
      setCart(data.data.items, data.data.subtotal);
    },
    [setCart],
  );

  const removeItem = useCallback(
    async (productId: string, variationId?: string, scaleId?: string) => {
      const params = new URLSearchParams();
      if (variationId) params.set('variationId', variationId);
      if (scaleId) params.set('scaleId', scaleId);
      const qs = params.toString();
      const { data } = await api.delete(`/cart/items/${productId}${qs ? `?${qs}` : ''}`);
      setCart(data.data.items, data.data.subtotal);
    },
    [setCart],
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number, variationId?: string, scaleId?: string) => {
      const params = new URLSearchParams();
      if (variationId) params.set('variationId', variationId);
      if (scaleId) params.set('scaleId', scaleId);
      const qs = params.toString();
      const { data } = await api.put(`/cart/items/${productId}${qs ? `?${qs}` : ''}`, { quantity });
      setCart(data.data.items, data.data.subtotal);
    },
    [setCart],
  );

  const clearCart = useCallback(async () => {
    await api.delete('/cart');
    clear();
  }, [clear]);

  return { items, subtotal, itemCount, fetchCart, addItem, removeItem, updateQuantity, clearCart };
}
