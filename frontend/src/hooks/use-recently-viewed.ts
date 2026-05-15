'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Product } from '@/types/product';

const RECENTLY_VIEWED_LIMIT = 4;

export function useRecentlyViewed(enabled = true) {
  return useQuery<Product[]>({
    queryKey: ['recently-viewed'],
    queryFn: async () => {
      const { data } = await api.get('/recently-viewed');
      const list = Array.isArray(data?.data) ? data.data : [];
      return list.slice(0, RECENTLY_VIEWED_LIMIT);
    },
    enabled,
    staleTime: 60_000,
  });
}
