import { API_URL } from '@/lib/constants';

export interface TopBarMessage {

  text: string;

  align: 'left' | 'right';
}

export interface TopBarConfig {
  messages: TopBarMessage[];
}

export const defaultTopBar: TopBarConfig = {
  messages: [
    { text: 'Sản phẩm độc quyền', align: 'left' },
    { text: 'Miễn phí vận chuyển trên 2.000.000đ', align: 'right' },
    { text: 'Thanh toán qua Momo giảm 3%', align: 'right' },
    { text: 'Hỗ trợ qua Zalo', align: 'right' },
  ],
};

export const TOPBAR_CACHE_TAG = 'site:topbar';

export async function getTopBar(): Promise<TopBarConfig> {
  try {
    const res = await fetch(`${API_URL}/api/v1/site/topbar`, {
      next: { revalidate: 300, tags: [TOPBAR_CACHE_TAG] },
    });
    if (!res.ok) return defaultTopBar;
    const json = (await res.json()) as { data?: TopBarConfig };
    return json.data ?? defaultTopBar;
  } catch {
    return defaultTopBar;
  }
}
