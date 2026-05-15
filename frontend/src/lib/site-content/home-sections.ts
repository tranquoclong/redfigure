
import { API_URL } from '@/lib/constants';
import type {
  HomeCategoryCard,
  HomeFeatureCard,
  HomeSection,
} from './types';

export const FEATURED_CATEGORIES_CACHE_TAG = 'site:featured-categories';

interface FeaturedCategoryRow {
  id: string;
  glowColor: string;
  displayLabel: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

export async function getFeaturedCategoryCards(): Promise<HomeCategoryCard[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/site/featured-categories`,
      { next: { revalidate: 300, tags: [FEATURED_CATEGORIES_CACHE_TAG] } },
    );
    if (!res.ok) return homeCategoryCards;
    const json = (await res.json()) as { data?: FeaturedCategoryRow[] };
    if (!json.data || json.data.length === 0) return homeCategoryCards;
    return json.data.map((row) => ({
      slug: row.category.slug,
      label: (row.displayLabel ?? row.category.name).toUpperCase(),
      glowColor: row.glowColor,
    }));
  } catch {
    return homeCategoryCards;
  }
}

export const homeSectionMeta: Record<string, HomeSection> = {
  categories: {
    id: 'categories',
    eyebrow: '// 01 danh mục',
    title: 'KHÁM PHÁ DANH MỤC',
    seeAllLink: { label: 'Xem tất cả →', href: '/products' },
  },
  featured: {
    id: 'featured',
    eyebrow: '// 02 nổi bật',
    title: 'SẢN PHẨM BÁN CHẠY',
  },
  why: {
    id: 'why',
    eyebrow: '// 03 tại sao chọn Red Figure',
    title: 'ĐIỂM KHÁC BIỆT CỦA CHÚNG TÔI',
  },
  newsletter: {
    id: 'newsletter',
    eyebrow: '// 04 danh sách ưu tiên',
    title: 'ĐĂNG KÝ NHẬN ƯU ĐÃI',
  },
};

export const homeCategoryCards: HomeCategoryCard[] = [
  { slug: 'pinups', label: 'Mô hình', glowColor: '#ff007a', count: 312 },
  { slug: 'fantasy', label: 'Trang phục', glowColor: '#00f0ff', count: 187 },
  { slug: 'sci-fi', label: 'Khoa học viễn tưởng', glowColor: '#b829ff', count: 98 },
  { slug: 'anime', label: 'Anime', glowColor: '#ffd166', count: 204 },
  { slug: 'bundles', label: 'Bộ sản phẩm', glowColor: '#ff66c4', count: 42 },
  { slug: 'exclusivos', label: 'Độc quyền', glowColor: '#8a2bff', count: 15 },
];


export const homeFeatureCards: HomeFeatureCard[] = [
  {
    number: '01',
    title: 'NHỰA CAO CẤP',
    description:
      'Nhựa ABS-Like cao cấp. Chi tiết mà những nơi khác không thể tái tạo.',
  },
  {
    number: '02',
    title: 'GIAO HÀNG AN TOÀN',
    description: 'Đóng gói chuyên nghiệp, chống va đập, đảm bảo nguyên vẹn sản phẩm khi đến tay bạn.',
  },
  {
    number: '03',
    title: 'SƠN THỦ CÔNG',
    description: 'Tùy chọn nhận hàng sơn bởi các nghệ sĩ hàng đầu Việt Nam.',
  },
  {
    number: '04',
    title: 'THANH TOÁN VỚI GIÁ ƯU ĐÃI',
    description: 'Tự động giảm giá khi thanh toán. Không cần mã giảm giá, không có điều khoản ẩn.',
  },
];
