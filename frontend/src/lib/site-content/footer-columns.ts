import { API_URL } from '@/lib/constants';
import type { FooterColumn, SocialLink } from './types';

export const FOOTER_CACHE_TAG = 'site:footer';

interface FooterApiRow {
  columns: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }>;
  socials: Array<{
    platform: 'instagram' | 'facebook' | 'twitter' | 'youtube' | 'tiktok';
    href: string;
  }>;
  legal: { copyright: string; mst?: string };
}

const SOCIAL_SHORT_LABEL: Record<string, string> = {
  instagram: 'ig',
  facebook: 'f',
  twitter: 'tt',
  youtube: 'yt',
  tiktok: 'tk',
};

export interface FooterData {
  columns: FooterColumn[];
  socials: SocialLink[];
  legal: { copyright: string; mst?: string };
}

export async function getFooter(): Promise<FooterData> {
  try {
    const res = await fetch(`${API_URL}/api/v1/site/footer`, {
      next: { revalidate: 300, tags: [FOOTER_CACHE_TAG] },
    });
    if (!res.ok) return defaultFooter();
    const json = (await res.json()) as { data?: FooterApiRow };
    if (!json.data) return defaultFooter();
    return {
      columns: json.data.columns,
      socials: json.data.socials.map((s) => ({
        platform: s.platform,
        href: s.href,
        shortLabel: SOCIAL_SHORT_LABEL[s.platform] ?? s.platform.slice(0, 2),
      })),
      legal: json.data.legal,
    };
  } catch {
    return defaultFooter();
  }
}

function defaultFooter(): FooterData {
  return {
    columns: footerColumns,
    socials: socialLinks,
    legal: footerLegal,
  };
}

export const footerColumns: FooterColumn[] = [
  {
    title: 'CỬA HÀNG',
    links: [
      { label: 'Sản phẩm', href: '/products' },
      { label: 'Sản phẩm mới', href: '/products?order=releases' },
      { label: 'Khuyến mãi', href: '/products?order=promotions' },
      { label: 'Bộ sản phẩm', href: '/c/bundles' },
      { label: 'Sản phẩm giới hạn', href: '/c/exclusivos' },
    ],
  },
  {
    title: 'TRỢ GIÚP',
    links: [
      { label: 'Hướng dẫn mua hàng', href: '/faq' },
      { label: 'Vận chuyển và giao hàng', href: '/faq' },
      { label: 'Đổi trả hàng', href: '/returns' },
      { label: 'Theo dõi đơn hàng', href: '/tracking' },
      { label: 'Liên hệ với chúng tôi', href: '/contact' },
    ],
  },
  {
    title: 'VỀ CHÚNG TÔI',
    links: [
      { label: 'Giới thiệu', href: '/about' },
      { label: 'Điều khoản sử dụng', href: '/terms' },
      { label: 'Chính sách bảo mật', href: '/privacy' },
      { label: 'Chính sách', href: '/terms' },
      { label: 'Quyền riêng tư', href: '/privacy' },
    ],
  },
];

export const socialLinks: SocialLink[] = [
  { platform: 'facebook', href: 'https://facebook.com/dohandmate', shortLabel: 'f' },
  { platform: 'instagram', href: 'https://instagram.com/dohandmate', shortLabel: 'ig' },
  { platform: 'twitter', href: 'https://twitter.com/dohandmate', shortLabel: 'tt' },
  { platform: 'youtube', href: 'https://youtube.com/@dohandmate', shortLabel: 'yt' },
];

export const footerLegal = {
  copyright: '© 2026 Đỏ Handmate · dohandmate.com',
  mst: '',
};
