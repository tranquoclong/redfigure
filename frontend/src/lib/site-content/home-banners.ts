import { API_URL } from '@/lib/constants';
import type { Banner } from './types';

export const defaultBanners: Banner[] = [
  {
    id: 'hero-default',
    eyebrow: '★ Bộ sưu tập Neon Vol. 2',
    title: 'MÔ HÌNH CỦA RED FIGURE',
    subtitle:
      'Mô hình cao cấp, in bằng nhựa resin, sơn thủ công và giao hàng an toàn. Đa dạng kích thước: 28mm, 32mm, 75mm và độc quyền.',
    primaryCta: { label: 'XEM SẢN PHẨM', href: '/products' },
    secondaryCta: {
      label: 'XEM SẢN PHẨM MỚI ▸',
      href: '/products?order=releases',
    },
    stats: [
      { value: '+1.200', label: 'sản phẩm' },
      { value: '4.9★', label: 'đánh giá trung bình' },
      { value: '48h', label: 'giao hàng nhanh' },
    ],
  },
];

export const BANNERS_CACHE_TAG = 'site:banners';

interface BannerApiRow {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  imageUrl: string | null;
}

function rowToBanner(row: BannerApiRow): Banner {
  return {
    id: row.id,
    eyebrow: row.eyebrow ?? undefined,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    primaryCta:
      row.primaryCtaLabel && row.primaryCtaHref
        ? { label: row.primaryCtaLabel, href: row.primaryCtaHref }
        : undefined,
    secondaryCta:
      row.secondaryCtaLabel && row.secondaryCtaHref
        ? { label: row.secondaryCtaLabel, href: row.secondaryCtaHref }
        : undefined,
    imageUrl: row.imageUrl ?? undefined,
  };
}

export async function getActiveBanners(): Promise<Banner[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/site/banners`, {
      next: { revalidate: 300, tags: [BANNERS_CACHE_TAG] },
    });
    if (!res.ok) return defaultBanners;
    const json = (await res.json()) as { data?: BannerApiRow[] };
    if (!json.data || json.data.length === 0) return defaultBanners;
    return json.data.map(rowToBanner);
  } catch {
    return defaultBanners;
  }
}

export const homeBanners = defaultBanners;
