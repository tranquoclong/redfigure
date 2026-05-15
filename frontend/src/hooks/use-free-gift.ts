'use client';

import { useQuery } from '@tanstack/react-query';
import { useCartStore } from '@/store/cart-store';
import { api } from '@/lib/api-client';
import type { FreeGiftPublic } from '@/types/free-gift';

interface UseFreeGiftResult {
  activeGift: FreeGiftPublic | null;

  isUnlocked: boolean;

  amountLeft: number;

  progress: number;
}

export function useFreeGift(opts?: {

  subtotalOverride?: number;
}): UseFreeGiftResult {

  const items = useCartStore((s) => s.items);
  const grossNonGiftSubtotal = items
    .filter((i) => !i.isFreeGift)
    .reduce((sum, i) => sum + i.price * i.quantity, 0);
  const nonGiftSubtotal =
    typeof opts?.subtotalOverride === 'number'
      ? Math.max(0, opts.subtotalOverride)
      : grossNonGiftSubtotal;

  const { data } = useQuery({
    queryKey: ['free-gift', 'active'],
    queryFn: async () => {
      const res = await api.get('/free-gifts/active');
      return (res.data?.data ?? null) as FreeGiftPublic | null;
    },
    staleTime: 60 * 1000,
  });

  const activeGift = data ?? null;
  if (!activeGift) {
    return { activeGift: null, isUnlocked: false, amountLeft: 0, progress: 0 };
  }

  const min = activeGift.minOrderAmount;
  const isUnlocked = nonGiftSubtotal >= min;
  const amountLeft = Math.max(0, min - nonGiftSubtotal);
  const progress = min > 0 ? Math.min(100, (nonGiftSubtotal / min) * 100) : 0;

  return { activeGift, isUnlocked, amountLeft, progress };
}
