import { API_URL } from '@/lib/constants';

export type MegaMenuBadge = 'NEW' | 'HOT' | 'SALE';

export interface MegaMenuLink {
  label: string;
  href: string;
}

export interface MegaMenuColumn {
  title: string;
  links: MegaMenuLink[];
}

export interface MegaMenuFeaturedImage {
  url: string;
  href: string;
  caption?: string;
}

export interface MegaMenuItem {
  id: string;
  label: string;
  href: string;
  badge?: MegaMenuBadge;
  columns?: MegaMenuColumn[];
  featuredImage?: MegaMenuFeaturedImage;
}

export interface MegaMenuConfig {
  items: MegaMenuItem[];
}

export const defaultMegaMenu: MegaMenuConfig = {
  items: [
    { id: 'home', label: 'Trang chủ', href: '/' },
    { id: 'products', label: 'Sản phẩm', href: '/products' },
    { id: 'pinups', label: 'Mô hình', href: '/c/pinups' },
    { id: 'fantasy', label: 'Trang phục', href: '/c/fantasy' },
    { id: 'bundles', label: 'Bộ sản phẩm', href: '/c/bundles' },
    { id: 'releases', label: 'Sản phẩm mới', href: '/products?order=releases' },
    { id: 'promotions', label: 'Khuyến mãi', href: '/products?promotion=1' },
  ],
};

export const MEGAMENU_CACHE_TAG = 'site:megamenu';

export async function getMegaMenu(): Promise<MegaMenuConfig> {
  try {
    const res = await fetch(`${API_URL}/api/v1/site/megamenu`, {
      next: { revalidate: 300, tags: [MEGAMENU_CACHE_TAG] },
    });
    if (!res.ok) return defaultMegaMenu;
    const json = (await res.json()) as { data?: MegaMenuConfig };
    return json.data ?? defaultMegaMenu;
  } catch {
    return defaultMegaMenu;
  }
}
