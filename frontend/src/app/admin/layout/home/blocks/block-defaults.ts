
import type {
  AnyHomeBlock,
  BlockType,
} from '@/lib/home-blocks';

function newId(): string {

  return `b-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export const TYPE_LABELS: Record<BlockType, string> = {
  'hero-carousel': 'Hero Carousel',
  'categories-strip': 'Danh mục nổi bật',
  'latest-products': 'Sản phẩm mới',
  'featured-products': 'Sản phẩm nổi bật',
  'promo-banner': 'Banner khuyến mãi',
  'how-it-works': 'Cách hoạt động',
  reviews: 'Đánh giá',
  faq: 'Câu hỏi thường gặp',
  'custom-quote': 'Báo giá',
  newsletter: 'Nhận tin',
  'trust-strip': 'Trust strip',
};

export const TYPE_DESCRIPTIONS: Record<BlockType, string> = {
  'hero-carousel': 'Carrossel de banners (gerenciados em /admin/layout/banners)',
  'categories-strip': 'Danh sách danh mục nổi bật (FeaturedCategory)',
  'latest-products': 'Sản phẩm mới',
  'featured-products': 'Sản phẩm nổi bật',
  'promo-banner': '2 banner cạnh nhau (Vận chuyển chủ đề magenta/cyan)',
  'how-it-works': '4 bước của quy trình (Chọn → Thanh toán → Sản xuất → Gửi)',
  reviews: 'Đánh giá nổi bật (admin đánh dấu tại /admin/reviews)',
  faq: 'Câu hỏi thường gặp (lấy từ Page slug=faq)',
  'custom-quote': 'CTA báo giá tùy chỉnh (.STL/.OBJ)',
  newsletter: 'Đăng ký nhận tin',
  'trust-strip': 'Trust strip (Gửi/Bảo hành)',
};

export const SINGLETON_TYPES: ReadonlySet<BlockType> = new Set([
  'hero-carousel',
  'categories-strip',
  'how-it-works',
  'reviews',
  'faq',
  'newsletter',
  'trust-strip',
]);

export function createBlockOfType(
  type: BlockType,
  order: number,
): AnyHomeBlock {
  const id = newId();
  const base = { id, order, isActive: true };
  switch (type) {
    case 'hero-carousel':
      return { ...base, type, data: { autoplayMs: 6000 } };
    case 'categories-strip':
      return {
        ...base,
        type,
        data: { eyebrow: '// 01', title: 'Danh mục' },
      };
    case 'latest-products':
      return {
        ...base,
        type,
        data: {
          eyebrow: '// 02 · Sản phẩm mới',
          title: 'Sản phẩm mới',
          limit: 4,
        },
      };
    case 'featured-products':
      return {
        ...base,
        type,
        data: {
          eyebrow: '// 03 · Bộ sưu tập nổi bật',
          title: 'Sản phẩm nổi bật',
          limit: 8,
          ctaLabel: 'Xem tất cả →',
          ctaHref: '/products?destaque=1',
        },
      };
    case 'promo-banner':
      return {
        ...base,
        type,
        data: {
          cards: [
            {
              eyebrow: '// QR · Giảm giá tự động',
              title: 'QR -10%',
              description: 'Áp dụng trực tiếp tại thanh toán — không cần mã giảm giá.',
              ctaLabel: 'Tận hưởng ngay',
              ctaHref: '/products',
              metaText: '+ VÍ ĐIỆN TỬ -5%',
              theme: 'magenta',
            },
          ],
        },
      };
    case 'how-it-works':
      return {
        ...base,
        type,
        data: {
          eyebrow: '// 05 · Từ lúc chọn đến lúc nhận hàng',
          title: 'Cách hoạt động',
          steps: [
            { number: '01', title: 'Chọn', description: 'Chọn sản phẩm trong danh mục.' },
            { number: '02', title: 'Thanh toán', description: 'Thanh toán bằng QR, ví điện tử hoặc thẻ.' },
            { number: '03', title: 'Sản xuất', description: 'Sản xuất bằng nhựa cao cấp.' },
            { number: '04', title: 'Giao hàng', description: 'Giao hàng an toàn' },
          ],
        },
      };
    case 'custom-quote':
      return {
        ...base,
        type,
        data: {
          eyebrow: '// 06 · Có mô hình của riêng bạn?',
          title: 'Chúng tôi in những gì bạn yêu cầu.',
          description:
            'Gửi tệp .STL hoặc .OBJ của bạn. Chúng tôi sẽ đánh giá tính khả thi về mặt kỹ thuật.',
          ctaLabel: 'Yêu cầu báo giá',
          ctaHref: '/quote',
          steps: [
            { number: '01', title: 'Gửi', description: '.STL · .OBJ' },
            { number: '02', title: 'Phân tích', description: 'Đánh giá kỹ thuật' },
            { number: '03', title: 'Báo giá', description: 'Giá + thời hạn' },
            { number: '04', title: 'Sản xuất', description: 'Sau khi phê duyệt' },
          ],
        },
      };
    case 'reviews':
      return {
        ...base,
        type,
        data: {
          eyebrow: '// 07 · Khách hàng nói gì',
          title: 'Đánh giá',
          limit: 3,
        },
      };
    case 'faq':
      return {
        ...base,
        type,
        data: {
          eyebrow: '// 08 · Hỏi-đáp',
          title: 'Câu hỏi thường gặp',
          pageSlug: 'faq',
          limit: 6,
        },
      };
    case 'trust-strip':
      return {
        ...base,
        type,
        data: {
          badges: [
            { icon: 'shipping', title: 'Giao hàng an toàn', description: 'Đóng gói an toàn.' },
            { icon: 'shield', title: 'Bảo hành 30 ngày', description: 'Bị hỏng? Chúng tôi sẽ thay thế.' },
            { icon: 'discount', title: 'QR -10%', description: 'Thẻ tín dụng trả góp 12 lần.' },
            { icon: 'age', title: 'Xác minh danh tính', description: 'Truy cập được bảo vệ.' },
          ],
        },
      };
    case 'newsletter':
      return {
        ...base,
        type,
        data: {
          eyebrow: '// Sản phẩm mới hàng tuần',
          title: 'Đăng ký nhận tin. Nhận hàng sớm.',
          description:
            'Sản phẩm mới, phiên bản giới hạn và mã giảm giá độc quyền. Không spam.',
          ctaLabel: 'Đăng ký nhận tin',
        },
      };
  }
}
