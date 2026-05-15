'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useCartStore } from '@/store/cart-store';
import { api } from '@/lib/api-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const hydrate = useAuthStore((s) => s.hydrate);
  const setCart = useCartStore((s) => s.setCart);

  useEffect(() => {
    hydrate().then(() => {

      const token = useAuthStore.getState().accessToken;
      if (token) {
        api.get('/cart')
          .then(({ data }) => setCart(data.data.items, data.data.subtotal))
          .catch(() => {});
      }
    });
  }, [hydrate, setCart]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
