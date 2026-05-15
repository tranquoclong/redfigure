'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trackViewItem } from '@/lib/ga4-events';
import { trackViewContent } from '@/lib/meta-pixel';
import { api } from '@/lib/api-client';
import type { Product } from '@/types/product';

interface Props {
  product: Product;
}

export function ProductViewTracker({ product }: Props) {
  const queryClient = useQueryClient();

  useEffect(() => {
    trackViewItem(product);
    trackViewContent(product);

    api
      .post(`/recently-viewed/${product.id}`)
      .then(() => queryClient.invalidateQueries({ queryKey: ['recently-viewed'] }))
      .catch(() => {});
  }, [product, queryClient]);
  return null;
}
