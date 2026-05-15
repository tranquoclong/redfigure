'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import type { UserProfile } from '@/types/user';

export function useMyProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  return useQuery<UserProfile | null>({
    queryKey: ['my-profile'],
    queryFn: async () => {

      const { data } = await api.get<{ data: UserProfile } | UserProfile>(
        '/users/me/profile',
      );
      const unwrap = data as { data?: UserProfile };
      return unwrap?.data ?? (data as UserProfile);
    },
    enabled: isHydrated && isAuthenticated,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
