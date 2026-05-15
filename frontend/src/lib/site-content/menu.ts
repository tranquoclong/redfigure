
import type { MenuItem } from './types';

export const menuItems: MenuItem[] = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Sản phẩm', href: '/products' },
  { label: 'Mô hình', href: '/c/pinups' },
  { label: 'Trang phục', href: '/c/fantasy' },
  { label: 'Bộ sản phẩm', href: '/c/bundles' },
  { label: 'Sản phẩm mới', href: '/products?order=releases' },
  { label: 'Khuyến mãi', href: '/products?order=promotions' },
];
