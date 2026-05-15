import { API_URL } from '@/lib/constants';

export interface GeneralConfig {
  siteName: string;
  siteTagline: string;
  ogImageUrl: string | null;
  loginFeaturedProductId: string | null;
  loginBadgeFeatured: string;
  loginBadgeFallback: string;
  loginFallbackTitle: string;
  loginSubtitle: string;
}

export const defaultGeneral: GeneralConfig = {
  siteName: 'Đỏ Handmate',
  siteTagline: 'cửa hàng đồ thủ công',
  ogImageUrl: null,
  loginFeaturedProductId: null,
  loginBadgeFeatured: 'ĐẶC BIỆT',
  loginBadgeFallback: 'PHIÊN BẢN GIỚI HẠN',
  loginFallbackTitle: 'Đỏ Handmate',
  loginSubtitle: 'Đăng ký và nhận mã giảm giá chào mừng',
};

export const GENERAL_CACHE_TAG = 'site:general';

export async function getGeneral(): Promise<GeneralConfig> {
  try {
    const res = await fetch(`${API_URL}/api/v1/site/general`, {
      next: { revalidate: 300, tags: [GENERAL_CACHE_TAG] },
    });
    if (!res.ok) return defaultGeneral;
    const json = (await res.json()) as { data?: GeneralConfig };
    return json.data ?? defaultGeneral;
  } catch {
    return defaultGeneral;
  }
}
