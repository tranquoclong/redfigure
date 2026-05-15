'use client';

import { create } from 'zustand';

interface MiniCartState {
  open: boolean;
  setOpen: (open: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
  toggle: () => void;
}

export const useMiniCart = create<MiniCartState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  openCart: () => set({ open: true }),
  closeCart: () => set({ open: false }),
  toggle: () => set({ open: !get().open }),
}));
