import { API_URL } from '@/lib/constants';

export interface LoginFeaturedProduct {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  alt: string | null;
}

export const LOGIN_FEATURED_CACHE_TAG = 'site:login-featured';

export async function getLoginFeaturedProduct(): Promise<LoginFeaturedProduct | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/site/login-featured`, {
      next: { revalidate: 300, tags: [LOGIN_FEATURED_CACHE_TAG] },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: LoginFeaturedProduct | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}
