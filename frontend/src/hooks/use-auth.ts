'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { ROUTES } from '@/lib/constants';

export function useAuth({ required = false } = {}) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (required && !isAuthenticated) {
      router.push(ROUTES.login);
    }
  }, [required, isAuthenticated, router]);

  return { user, isAuthenticated, logout };
}
