

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const API_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000', 10);

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://redfigure.com.vn';
export const SITE_NAME = 'Red Figure';
export const SITE_DESCRIPTION = 'Cửa hàng mô hình cao cấp cho người sưu tập và game thủ';

export const ITEMS_PER_PAGE = 20;

export const ROUTES = {
  home: '/',
  products: '/products',
  product: (slug: string) => `/p/${slug}`,
  category: (slug: string) => `/c/${slug}`,
  tag: (slug: string) => `/t/${slug}`,
  brand: (slug: string) => `/m/${slug}`,
  search: '/search',
  cart: '/cart',
  checkoutIdentification: '/checkout/identification',
  checkout: '/checkout',
  login: '/login',
  register: '/register',
  account: '/my-account',
  orders: '/my-account/orders',
  wishlist: '/my-account/wishlist',
  recentlyViewed: '/my-account/recently-viewed',
  admin: '/admin',
} as const;

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

const TZ = 'Asia/Ho_Chi_Minh';

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('vi-VN', { timeZone: TZ });
}

export function formatDateLong(date: string | Date): string {
  return new Date(date).toLocaleDateString('vi-VN', {
    timeZone: TZ,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString('vi-VN', { timeZone: TZ, ...options });
}

export function formatDateTimeShort(date: string | Date): string {
  return new Date(date).toLocaleString('vi-VN', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ADDRESS_LIMITS = {
  recipient: 80,
  street: 200,
  ward: 40,
  district: 40,
  province: 2,
  postalCode: 8,
  name: 80,
  email: 100,
} as const;

export const VIETNAM_PROVINCES = [
  'AG', 'BG', 'BK', 'BL', 'BN', 'BT', 'BP', 'BR', 'BD', 'BI',
  'CB', 'CT', 'DA', 'DB', 'DC', 'DD', 'DI', 'DN', 'DT', 'GL',
  'HG', 'HA', 'HB', 'HC', 'HD', 'HP', 'HU', 'HY', 'KH', 'KG',
  'KT', 'LA', 'LD', 'LI', 'LS', 'LW', 'ND', 'NA', 'NB', 'NT',
  'PT', 'PY', 'QB', 'QG', 'QN', 'QT', 'ST', 'SL', 'TB', 'TC',
  'TH', 'TT', 'TG', 'TV', 'TQ', 'VL', 'VC', 'VT', 'YB'
] as const;

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCccd(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
