'use client';

import { create } from 'zustand';
import type { CartItem } from '@/types/cart';

interface CartState {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  setCart: (items: CartItem[], subtotal: number) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  subtotal: 0,
  itemCount: 0,
  setCart: (items, subtotal) =>
    set({
      items,
      subtotal,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    }),
  clear: () => set({ items: [], subtotal: 0, itemCount: 0 }),
}));
