import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { stripBidi } from '../common/utils/strip-bidi';
import {
  AnyHomeBlock,
  HomeBlocksConfig,
  invalidateHomeBlocksCaches,
} from './home-blocks.types';
import {
  parseStoredBlocks,
  validateAndNormalizeBlocks,
} from './home-blocks.validator';

export type TopBarAlign = 'left' | 'right';

export interface TopBarMessage {
  text: string;
  align: TopBarAlign;
}

export interface TopBarConfig {
  messages: TopBarMessage[];
}

export interface MarqueeConfig {
  items: string[];
}

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

export type SetGeneralInput = Omit<
  GeneralConfig,
  | 'ogImageUrl'
  | 'loginFeaturedProductId'
  | 'loginBadgeFeatured'
  | 'loginBadgeFallback'
  | 'loginFallbackTitle'
  | 'loginSubtitle'
> & {
  ogImageUrl?: string | null;
  loginFeaturedProductId?: string | null;
  loginBadgeFeatured?: string;
  loginBadgeFallback?: string;
  loginFallbackTitle?: string;
  loginSubtitle?: string;
};

export interface LoginFeaturedProductDTO {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  alt: string | null;
}

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

export interface FooterColumn {
  title: string;
  links: MegaMenuLink[];
}

export type FooterSocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'youtube'
  | 'tiktok';

export interface FooterSocial {
  platform: FooterSocialPlatform;
  href: string;
}

export interface FooterConfig {
  columns: FooterColumn[];
  socials: FooterSocial[];
  legal: {
    copyright: string;
    mst?: string;
  };
}

export const DEFAULTS = {
  topBar: {
    messages: [
      { text: 'Restricted access', align: 'left' },
      { text: 'Free shipping over 299.000VND', align: 'right' },
      { text: 'Thanh toán nhanh chóng', align: 'right' },
      { text: 'Zalo support', align: 'right' },
    ],
  } as TopBarConfig,
  marquee: {
    items: [
      'DISCREET SHIPPING',
      'PREMIUM RESIN',
      'HAND PAINTED',
      '28/32/75 SCALES',
      'LIMITED EDITIONS',
      'VN ARTISTS',
    ],
  } as MarqueeConfig,
  general: {
    siteName: 'Red Figure',
    siteTagline: 'Mô hình cao cấp dành cho người sưu tầm.',
    ogImageUrl: null,
    loginFeaturedProductId: null,
    loginBadgeFeatured: 'FEATURED',
    loginBadgeFallback: 'LIMITED EDITION',
    loginFallbackTitle: 'Aurora · Cyber Vixen',
    loginSubtitle: 'Sign up and get a welcome coupon',
  } as GeneralConfig,
  megaMenu: {
    items: [
      { id: 'home', label: 'Home', href: '/' },
      { id: 'products', label: 'products', href: '/products' },
      { id: 'pinups', label: 'Pinups', href: '/c/pinups' },
      { id: 'fantasy', label: 'fantasy', href: '/c/fantasy' },
      { id: 'bundles', label: 'Bundles', href: '/c/bundles' },
      {
        id: 'releases',
        label: 'New Releases',
        href: '/products?order=releases',
      },
      { id: 'promotions', label: 'promotions', href: '/products?promotion=1' },
    ],
  } as MegaMenuConfig,
  footer: {
    columns: [
      {
        title: 'SHOP',
        links: [
          { label: 'products', href: '/products' },
          { label: 'Bundles', href: '/c/bundles' },
          { label: 'New Releases', href: '/products?order=releases' },
          { label: 'Sale', href: '/products?promotion=1' },
        ],
      },
      {
        title: 'HELP',
        links: [
          { label: 'How to buy', href: '/faq' },
          { label: 'shipping and delivery times', href: '/faq' },
          { label: 'returns', href: '/returns' },
          { label: 'Contact', href: '/contact' },
        ],
      },
      {
        title: 'INSTITUCIONAL',
        links: [
          { label: 'About', href: '/about' },
          { label: 'Blog', href: '/blog' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
        ],
      },
    ],
    socials: [
      { platform: 'instagram', href: 'https://instagram.com/redfigure' },
      { platform: 'facebook', href: 'https://facebook.com/redfigure' },
    ],
    legal: {
      copyright: '© 2026 Red Figure · redfigure.com',
    },
  } as FooterConfig,

  homeBlocks: {
    blocks: [
      {
        id: 'default-hero-carousel',
        type: 'hero-carousel',
        order: 0,
        isActive: true,
        data: { autoplayMs: 6000 },
      },
      {
        id: 'default-categories-strip',
        type: 'categories-strip',
        order: 1,
        isActive: true,
        data: { eyebrow: '// 01', title: 'Categories' },
      },
      {
        id: 'default-latest-products',
        type: 'latest-products',
        order: 2,
        isActive: true,
        data: {
          eyebrow: '// 02 · Sản phẩm mới ra mắt',
          title: 'Sản phẩm mới',
          limit: 4,
        },
      },
      {
        id: 'default-featured-products',
        type: 'featured-products',
        order: 3,
        isActive: true,
        data: {
          eyebrow: '// 03 · Bộ sưu tập nổi bật',
          title: 'Bộ sưu tập',
          limit: 8,
          ctaLabel: 'Xem thêm ▸',
          ctaHref: '/products?destaque=1',
        },
      },
      {
        id: 'default-promo-banner',
        type: 'promo-banner',
        order: 4,
        isActive: true,
        data: {
          cards: [
            {
              eyebrow: '// THANH TOÁN · Giảm giá tự động',
              title: 'THANH TOÁN −10%',
              description:
                'Giảm giá 10% cho bất kỳ mô hình nào trong danh mục. Được áp dụng trực tiếp khi thanh toán — không cần mã giảm giá, không có điều khoản phụ.',
              ctaLabel: 'Mua ngay',
              ctaHref: '/products',
              metaText: '+ COD - 5%',
              theme: 'magenta',
            },
            {
              eyebrow: '// VẬN CHUYỂN · an toàn và nhanh chóng',
              title: 'Giao hàng toàn quốc',
              description:
                'Giao hàng nhanh chóng, an toàn và đảm bảo. Sản phẩm được đóng gói cẩn thận để đảm bảo đến tay bạn trong tình trạng tốt nhất.',
              metaText: 'Giao hàng toàn quốc',
              theme: 'cyan',
            },
          ],
        },
      },
      {
        id: 'default-how-it-works',
        type: 'how-it-works',
        order: 5,
        isActive: true,
        data: {
          eyebrow: '// 05 · Từ lúc đặt hàng đến khi nhận hàng',
          title: 'Quy trình đặt hàng',
          steps: [
            {
              number: '01',
              title: 'Lựa chọn',
              description:
                'Xem sản phẩm, chọn kích thước và phiên bản. Mỗi sản phẩm hiển thị thời gian sản xuất.',
            },
            {
              number: '02',
              title: 'Thanh toán',
              description:
                'Thanh toán với mã QR (giảm 10%), COD (giảm 5%) hoặc thẻ tín dụng trả góp lên đến 12 lần không lãi suất (sắp có).',
            },
            {
              number: '03',
              title: 'Sản xuất',
              description:
                'In lên nhựa cao cấp trong tối đa 5 ngày làm việc. Bạn sẽ nhận được email khi đơn hàng được đưa vào sản xuất.',
            },
            {
              number: '04',
              title: 'Chúng tôi giao hàng',
              description:
                'Giao hàng an toàn và nhanh chóng, đóng gói cẩn thận để đảm bảo đến tay bạn trong tình trạng tốt nhất. Bạn sẽ nhận được mã theo dõi qua email.',
            },
          ],
        },
      },
      {
        id: 'default-custom-quote',
        type: 'custom-quote',
        order: 6,
        isActive: true,
        data: {
          eyebrow: '// 06 · Mô hình thiết kế theo yêu cầu',
          title: 'Biến ý tưởng của bạn thành hiện thực',
          description:
            'Gửi mô hình .PNG hoặc .JPG của bạn. Chúng tôi sẽ đánh giá tính khả thi về mặt kỹ thuật và gửi báo giá cá nhân hóa có tính đến tỷ lệ, nhựa và xử lý hậu kỳ.',
          ctaLabel: 'Yêu cầu báo giá',
          ctaHref: '/quote',
          steps: [
            {
              number: '01',
              title: 'Gửi ảnh',
              description: '.PNG · .JPG',
            },
            {
              number: '02',
              title: 'Phân tích',
              description: 'Đánh giá kỹ thuật',
            },
            {
              number: '03',
              title: 'Báo giá',
              description: 'Giá + deadline',
            },
            {
              number: '04',
              title: 'Sản xuất',
              description: 'Sau khi được phê duyệt',
            },
          ],
        },
      },
      {
        id: 'default-reviews',
        type: 'reviews',
        order: 7,
        isActive: true,
        data: {
          eyebrow: '// 07 · What people say',
          title: 'Reviews from those who have already bought',
          limit: 3,
        },
      },
      {
        id: 'default-faq',
        type: 'faq',
        order: 8,
        isActive: true,
        data: {
          eyebrow: '// 08 · Câu hỏi thường gặp',
          title: 'Các câu hỏi thường gặp',
          pageSlug: 'faq',
          limit: 6,
        },
      },
      {
        id: 'default-trust-strip',
        type: 'trust-strip',
        order: 9,
        isActive: true,
        data: {
          badges: [
            {
              icon: 'shipping',
              title: 'Vận chuyển an toàn',
              description: 'Vận chuyển an toàn và nhanh chóng. Được đóng gói cẩn thận để đảm bảo đến tay bạn trong tình trạng tốt nhất.',
            },
            {
              icon: 'shield',
              title: 'Được đổi trả',
              description: 'Được đổi trả nếu mô hình bị lỗi hoặc hư hỏng trong quá trình vận chuyển.',
            },
            {
              icon: 'discount',
              title: 'QR -10% / COD -5%',
              description: 'Giảm giá 10% cho bất kỳ mô hình nào trong danh mục. Được áp dụng trực tiếp khi thanh toán — không cần mã giảm giá, không có điều khoản phụ.',
            },
            {
              icon: 'payment',
              title: 'Đa dạng phương thức thanh toán',
              description: 'Chấp nhận thanh toán chuyển khoản ngân hàng và tiền mặt khi nhận hàng.',
            },
          ],
        },
      },
      {
        id: 'default-newsletter',
        type: 'newsletter',
        order: 10,
        isActive: true,
        data: {
          eyebrow: '// 10 · Sản phẩm mới hàng tuần',
          title: 'Nhận thông tin sớm nhất',
          description:
            'Sản phẩm mới, phiên bản giới hạn và phiếu giảm giá độc quyền. Không spam — chỉ gửi các thông tin quan trọng.',
          ctaLabel: 'Đăng ký ngay',
        },
      },
    ] as AnyHomeBlock[],
  } as HomeBlocksConfig,
} as const;

function normalizeLoginCopy(
  raw: unknown,
  fieldName: string,
  maxLen: number,
  fallback: string,
): string {
  if (raw === undefined) return fallback;
  if (raw === null) return '';
  if (typeof raw !== 'string') {
    throw new BadRequestException(`general.${fieldName} must be a string`);
  }
  const trimmed = raw.trim();
  if (trimmed.length > maxLen) {
    throw new BadRequestException(
      `general.${fieldName}: maximum ${maxLen} characters`,
    );
  }
  return trimmed;
}

function normalizeOgImageUrl(raw: unknown): string | null {
  return sanitizeOptionalHttpUrl(raw, 'general.ogImageUrl');
}

function sanitizeOptionalHttpUrl(
  raw: unknown,
  fieldName: string,
): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string or null`);
  }
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException(
      `${fieldName} must be a valid http(s) URL`,
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(
      `${fieldName} must use http or https protocol`,
    );
  }
  return trimmed;
}

const KEYS = {
  topBar: { db: 'site_topbar', cache: 'cache:site:topbar' },
  marquee: { db: 'site_marquee', cache: 'cache:site:marquee' },
  general: { db: 'site_general', cache: 'cache:site:general' },
  megaMenu: { db: 'site_megamenu', cache: 'cache:site:megamenu' },
  footer: { db: 'site_footer', cache: 'cache:site:footer' },

  homeBlocks: { db: 'site_home_blocks', cache: 'cache:site:home-blocks' },
  loginFeatured: { cache: 'cache:site:login-featured' },
} as const;

const CACHE_TTL_SECONDS = 3600;

const LOGIN_FEATURED_TTL_SECONDS = 60;

@Injectable()
export class SiteConfigService {
  private readonly logger = new Logger(SiteConfigService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) { }

  async getTopBar(): Promise<TopBarConfig> {
    return this.readWithCache<TopBarConfig>(
      KEYS.topBar.cache,
      KEYS.topBar.db,
      DEFAULTS.topBar,
    );
  }

  async setTopBar(dto: TopBarConfig): Promise<TopBarConfig> {
    if (!Array.isArray(dto.messages) || dto.messages.length === 0) {
      throw new BadRequestException(
        'topbar.messages must contain at least 1 item',
      );
    }
    for (const msg of dto.messages) {
      if (!msg || typeof msg.text !== 'string' || msg.text.trim() === '') {
        throw new BadRequestException(
          'topbar.messages: each item needs non-empty "text"',
        );
      }
      if (msg.align !== 'left' && msg.align !== 'right') {
        throw new BadRequestException(
          'topbar.messages.align: must be "left" or "right"',
        );
      }
    }
    const sanitized: TopBarConfig = {
      messages: dto.messages.map((m) => ({
        text: m.text.trim(),
        align: m.align,
      })),
    };
    await this.settings.setJson(KEYS.topBar.db, sanitized);
    await this.redis.del(KEYS.topBar.cache);
    return sanitized;
  }

  async getMarquee(): Promise<MarqueeConfig> {
    return this.readWithCache<MarqueeConfig>(
      KEYS.marquee.cache,
      KEYS.marquee.db,
      DEFAULTS.marquee,
    );
  }

  async setMarquee(dto: MarqueeConfig): Promise<MarqueeConfig> {
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException(
        'marquee.items must contain at least 1 item',
      );
    }
    const trimmed = dto.items.map((i) =>
      typeof i === 'string' ? i.trim() : '',
    );
    if (trimmed.some((i) => i === '')) {
      throw new BadRequestException(
        'marquee.items: empty items are not allowed',
      );
    }
    const sanitized: MarqueeConfig = { items: trimmed };
    await this.settings.setJson(KEYS.marquee.db, sanitized);
    await this.redis.del(KEYS.marquee.cache);
    return sanitized;
  }

  async getGeneral(): Promise<GeneralConfig> {
    const raw = await this.readWithCache<GeneralConfig>(
      KEYS.general.cache,
      KEYS.general.db,
      DEFAULTS.general,
    );

    return {
      ...raw,
      ogImageUrl: raw.ogImageUrl ?? null,
      loginFeaturedProductId: raw.loginFeaturedProductId ?? null,
      loginBadgeFeatured:
        raw.loginBadgeFeatured ?? DEFAULTS.general.loginBadgeFeatured,
      loginBadgeFallback:
        raw.loginBadgeFallback ?? DEFAULTS.general.loginBadgeFallback,
      loginFallbackTitle:
        raw.loginFallbackTitle ?? DEFAULTS.general.loginFallbackTitle,
      loginSubtitle: raw.loginSubtitle ?? DEFAULTS.general.loginSubtitle,
    };
  }

  async setGeneral(dto: SetGeneralInput): Promise<GeneralConfig> {
    if (typeof dto.siteName !== 'string' || dto.siteName.trim() === '') {
      throw new BadRequestException('general.siteName cannot be empty');
    }
    if (typeof dto.siteTagline !== 'string') {
      throw new BadRequestException('general.siteTagline is required');
    }
    const loginFeaturedProductId = await this.normalizeLoginProductId(
      dto.loginFeaturedProductId,
    );
    const sanitized: GeneralConfig = {
      siteName: dto.siteName.trim(),
      siteTagline: dto.siteTagline.trim(),
      ogImageUrl: normalizeOgImageUrl(dto.ogImageUrl),
      loginFeaturedProductId,
      loginBadgeFeatured: normalizeLoginCopy(
        dto.loginBadgeFeatured,
        'loginBadgeFeatured',
        40,
        DEFAULTS.general.loginBadgeFeatured,
      ),
      loginBadgeFallback: normalizeLoginCopy(
        dto.loginBadgeFallback,
        'loginBadgeFallback',
        40,
        DEFAULTS.general.loginBadgeFallback,
      ),
      loginFallbackTitle: normalizeLoginCopy(
        dto.loginFallbackTitle,
        'loginFallbackTitle',
        80,
        DEFAULTS.general.loginFallbackTitle,
      ),
      loginSubtitle: normalizeLoginCopy(
        dto.loginSubtitle,
        'loginSubtitle',
        160,
        DEFAULTS.general.loginSubtitle,
      ),
    };
    await this.settings.setJson(KEYS.general.db, sanitized);
    await this.redis.del(KEYS.general.cache);

    await this.redis.del(KEYS.loginFeatured.cache);
    return sanitized;
  }

  private async normalizeLoginProductId(raw: unknown): Promise<string | null> {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'string') {
      throw new BadRequestException(
        'general.loginFeaturedProductId must be a string or null',
      );
    }
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const exists = await this.prisma.product.findFirst({
      where: { id: trimmed, isActive: true, isDraft: false },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException(
        'general.loginFeaturedProductId: product not found, inactive or draft',
      );
    }
    return trimmed;
  }

  async getLoginFeaturedProduct(): Promise<LoginFeaturedProductDTO | null> {
    try {
      const cached = await this.redis.getJson<{
        value: LoginFeaturedProductDTO | null;
      }>(KEYS.loginFeatured.cache);
      if (cached !== null) return cached.value;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to read cache login-featured: ${msg}`);
    }
    const dto = await this.resolveLoginFeaturedProduct();
    try {
      await this.redis.setJson(
        KEYS.loginFeatured.cache,
        { value: dto },
        LOGIN_FEATURED_TTL_SECONDS,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to write cache login-featured: ${msg}`);
    }
    return dto;
  }

  private async resolveLoginFeaturedProduct(): Promise<LoginFeaturedProductDTO | null> {
    const general = await this.getGeneral();
    if (general.loginFeaturedProductId) {
      const selected = await this.prisma.product.findFirst({
        where: {
          id: general.loginFeaturedProductId,
          isActive: true,
          isDraft: false,
        },
        select: this.loginProductSelect(),
      });
      const dto = this.toLoginFeaturedDto(selected);
      if (dto) return dto;
    }

    const candidates = await this.prisma.product.findMany({
      where: { featured: true, isActive: true, isDraft: false },
      select: this.loginProductSelect(),
      take: 20,
    });
    for (const candidate of candidates) {
      const dto = this.toLoginFeaturedDto(candidate);
      if (dto) return dto;
    }
    return null;
  }

  private loginProductSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      images: {

        orderBy: [{ isMain: 'desc' as const }, { order: 'asc' as const }],
        take: 1,
        select: {
          mediaFile: {
            select: { gallery: true, alt: true },
          },
        },
      },
    };
  }

  private toLoginFeaturedDto(
    product: {
      id: string;
      name: string;
      slug: string;
      images: { mediaFile: { gallery: string; alt: string | null } | null }[];
    } | null,
  ): LoginFeaturedProductDTO | null {
    if (!product) return null;
    const main = product.images[0];
    if (!main?.mediaFile?.gallery) return null;
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: main.mediaFile.gallery,
      alt: main.mediaFile.alt ?? null,
    };
  }

  async getMegaMenu(): Promise<MegaMenuConfig> {
    return this.readWithCache<MegaMenuConfig>(
      KEYS.megaMenu.cache,
      KEYS.megaMenu.db,
      DEFAULTS.megaMenu,
    );
  }

  async setMegaMenu(dto: MegaMenuConfig): Promise<MegaMenuConfig> {
    if (!Array.isArray(dto.items)) {
      throw new BadRequestException('megamenu.items must be an array');
    }
    const ids = new Set<string>();
    for (const item of dto.items) {
      if (!item || typeof item.id !== 'string' || item.id.trim() === '') {
        throw new BadRequestException('megamenu: each item needs an id');
      }
      if (ids.has(item.id)) {
        throw new BadRequestException(`megamenu: duplicate id "${item.id}"`);
      }
      ids.add(item.id);
      if (typeof item.label !== 'string' || item.label.trim() === '') {
        throw new BadRequestException(
          `megamenu: item "${item.id}" needs non-empty label`,
        );
      }
      if (typeof item.href !== 'string' || item.href.trim() === '') {
        throw new BadRequestException(
          `megamenu: item "${item.id}" needs non-empty href`,
        );
      }
      if (item.badge !== undefined) {
        if (!['NEW', 'HOT', 'SALE'].includes(item.badge)) {
          throw new BadRequestException(
            `megamenu: invalid badge in "${item.id}" (use NEW, HOT or SALE)`,
          );
        }
      }
      if (item.columns !== undefined) {
        if (!Array.isArray(item.columns)) {
          throw new BadRequestException(
            `megamenu: columns of "${item.id}" must be an array`,
          );
        }
        for (const col of item.columns) {
          if (typeof col.title !== 'string' || col.title.trim() === '') {
            throw new BadRequestException(
              `megamenu: column without title in "${item.id}"`,
            );
          }
          if (!Array.isArray(col.links)) {
            throw new BadRequestException(
              `megamenu: links of "${col.title}" must be an array`,
            );
          }
          for (const link of col.links) {
            if (
              typeof link.label !== 'string' ||
              typeof link.href !== 'string' ||
              link.label.trim() === '' ||
              link.href.trim() === ''
            ) {
              throw new BadRequestException(
                `megamenu: invalid link in "${col.title}"`,
              );
            }
          }
        }
      }
    }
    await this.settings.setJson(KEYS.megaMenu.db, dto);
    await this.redis.del(KEYS.megaMenu.cache);
    return dto;
  }

  async getFooter(): Promise<FooterConfig> {
    return this.readWithCache<FooterConfig>(
      KEYS.footer.cache,
      KEYS.footer.db,
      DEFAULTS.footer,
    );
  }

  async setFooter(dto: FooterConfig): Promise<FooterConfig> {
    if (!Array.isArray(dto.columns)) {
      throw new BadRequestException('footer.columns must be an array');
    }
    for (const col of dto.columns) {
      if (typeof col.title !== 'string' || col.title.trim() === '') {
        throw new BadRequestException('footer: column without title');
      }
      if (!Array.isArray(col.links)) {
        throw new BadRequestException(
          `footer: links of "${col.title}" must be an array`,
        );
      }
      for (const link of col.links) {
        if (
          typeof link.label !== 'string' ||
          typeof link.href !== 'string' ||
          link.label.trim() === '' ||
          link.href.trim() === ''
        ) {
          throw new BadRequestException(
            `footer: invalid link in "${col.title}"`,
          );
        }
      }
    }
    if (!Array.isArray(dto.socials)) {
      throw new BadRequestException('footer.socials must be an array');
    }
    for (const s of dto.socials) {
      if (
        !['instagram', 'facebook', 'twitter', 'youtube', 'tiktok'].includes(
          s.platform,
        )
      ) {
        throw new BadRequestException(
          `footer: invalid social platform "${s.platform}"`,
        );
      }
      if (typeof s.href !== 'string' || s.href.trim() === '') {
        throw new BadRequestException(
          `footer: href required in ${s.platform}`,
        );
      }
    }
    if (
      !dto.legal ||
      typeof dto.legal.copyright !== 'string' ||
      dto.legal.copyright.trim() === ''
    ) {
      throw new BadRequestException('footer.legal.copyright required');
    }
    await this.settings.setJson(KEYS.footer.db, dto);
    await this.redis.del(KEYS.footer.cache);
    return dto;
  }

  async getHomeBlocks(): Promise<HomeBlocksConfig> {
    const cacheDisabled = await this.isCacheDisabled();

    if (!cacheDisabled) {
      try {
        const cached = await this.redis.getJson<HomeBlocksConfig>(
          KEYS.homeBlocks.cache,
        );
        if (cached) return cached;
      } catch (err) {
        this.logger.warn(
          `Failed to read cache "${KEYS.homeBlocks.cache}": ${(err as Error).message}`,
        );
      }
    }

    const stored = await this.settings.getJson<unknown>(KEYS.homeBlocks.db);
    let value: HomeBlocksConfig;

    if (stored) {

      const parsed = parseStoredBlocks(stored, {
        onWarn: (msg) => this.logger.warn(`home-blocks parse: ${msg}`),
      });
      value =
        parsed && parsed.blocks.length > 0
          ? parsed
          : (DEFAULTS.homeBlocks as HomeBlocksConfig);
    } else {
      value = DEFAULTS.homeBlocks as HomeBlocksConfig;
    }

    if (stored && !cacheDisabled) {
      try {
        await this.redis.setJson(
          KEYS.homeBlocks.cache,
          value,
          CACHE_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to write cache "${KEYS.homeBlocks.cache}": ${(err as Error).message}`,
        );
      }
    }
    return value;
  }

  async setHomeBlocks(rawBlocks: unknown): Promise<HomeBlocksConfig> {
    if (!Array.isArray(rawBlocks)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'blocks: must be an array',
        fieldName: 'blocks',
      });
    }
    const validated = validateAndNormalizeBlocks(
      rawBlocks as Parameters<typeof validateAndNormalizeBlocks>[0],
    );
    await this.settings.setJson(KEYS.homeBlocks.db, validated);

    await invalidateHomeBlocksCaches(this.redis, this.logger);
    return validated;
  }

  async invalidateHomeBlocksCache(): Promise<void> {
    await invalidateHomeBlocksCaches(this.redis, this.logger);
  }

  async flushAllCaches(): Promise<{
    flushed: string[];
    failed: string[];
    scannedCount: number;
  }> {
    let scannedKeys: string[] = [];
    try {
      scannedKeys = await this.redis.keys('cache:*');
    } catch (err) {
      this.logger.error(
        `flushAllCaches: KEYS scan failed — ${(err as Error).message}`,
      );
      throw err;
    }

    if (scannedKeys.length === 0) {
      return { flushed: [], failed: [], scannedCount: 0 };
    }

    const delResults = await Promise.allSettled(
      scannedKeys.map((key) => this.redis.del(key)),
    );

    const verifyResults = await Promise.allSettled(
      scannedKeys.map((key) => this.redis.exists(key)),
    );

    const flushed: string[] = [];
    const failed: string[] = [];
    scannedKeys.forEach((key, i) => {
      const delOk = delResults[i].status === 'fulfilled';
      const verifyResult = verifyResults[i];
      const stillExists =
        verifyResult.status === 'fulfilled' && verifyResult.value === true;

      if (delOk && !stillExists) {
        flushed.push(key);
      } else {
        failed.push(key);
        if (!delOk) {
          this.logger.warn(
            `flushAllCaches: del(${key}) failed — ${((delResults[i] as PromiseRejectedResult).reason as Error)
              ?.message ?? 'unknown'
            }`,
          );
        } else if (stillExists) {
          this.logger.warn(
            `flushAllCaches: ${key} still exists after DEL — verifyResult ${JSON.stringify(verifyResult)}`,
          );
        }
      }
    });

    return {
      flushed,
      failed,
      scannedCount: scannedKeys.length,
    };
  }

  async isCacheDisabled(): Promise<boolean> {
    try {
      const value = await this.settings.getJson<boolean>('site_cache_disabled');
      return value === true;
    } catch {
      return false;
    }
  }

  async setCacheDisabled(disabled: boolean): Promise<{ disabled: boolean }> {
    await this.settings.setJson('site_cache_disabled', disabled);
    if (disabled) {
      await this.flushAllCaches().catch((err) =>
        this.logger.warn(
          `setCacheDisabled: Flush after toggle failed — ${(err as Error).message}`,
        ),
      );
    }
    return { disabled };
  }

  private async readWithCache<T>(
    cacheKey: string,
    dbKey: string,
    fallback: T,
  ): Promise<T> {
    const cacheDisabled = await this.isCacheDisabled();

    if (!cacheDisabled) {
      try {
        const cached = await this.redis.getJson<T>(cacheKey);
        if (cached) return cached;
      } catch (err) {
        this.logger.warn(
          `Failed to read cache "${cacheKey}": ${(err as Error).message}`,
        );
      }
    }

    const stored = await this.settings.getJson<T>(dbKey);
    const value = stored ?? fallback;
    if (stored && !cacheDisabled) {
      try {
        await this.redis.setJson(cacheKey, value, CACHE_TTL_SECONDS);
      } catch (err) {
        this.logger.warn(
          `Failed to write cache "${cacheKey}": ${(err as Error).message}`,
        );
      }
    }
    return value;
  }
}
