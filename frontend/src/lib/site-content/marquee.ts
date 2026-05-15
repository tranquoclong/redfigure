import { API_URL } from '@/lib/constants';

export interface MarqueeConfig {
  items: string[];
}

export const defaultMarquee: MarqueeConfig = {
  items: [
    'GIAO HÀNG AN TOÀN',
    'NHỰA CAO CẤP',
    'SƠN THỦ CÔNG',
    'KÍCH THƯỚC 28/32/75',
    'PHIÊN BẢN GIỚI HẠN',
    'NGHỆ SĨ VIỆT NAM',
  ],
};

export const MARQUEE_CACHE_TAG = 'site:marquee';

export async function getMarquee(): Promise<MarqueeConfig> {
  try {
    const res = await fetch(`${API_URL}/api/v1/site/marquee`, {
      next: { revalidate: 300, tags: [MARQUEE_CACHE_TAG] },
    });
    if (!res.ok) return defaultMarquee;
    const json = (await res.json()) as { data?: MarqueeConfig };
    return json.data ?? defaultMarquee;
  } catch {
    return defaultMarquee;
  }
}
