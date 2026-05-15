

export const BLOCK_TYPES = [
  'hero-carousel',
  'categories-strip',
  'latest-products',
  'featured-products',
  'promo-banner',
  'how-it-works',
  'reviews',
  'faq',
  'custom-quote',
  'newsletter',
  'trust-strip',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const SINGLETON_BLOCK_TYPES: ReadonlySet<BlockType> = new Set([
  'hero-carousel',
  'categories-strip',
  'how-it-works',
  'reviews',
  'faq',
  'newsletter',
  'trust-strip',
]);

export interface HeroCarouselData {

  autoplayMs?: number;
}

export interface CategoriesStripData {
  eyebrow: string;
  title: string;
}

export interface LatestProductsData {
  eyebrow: string;
  title: string;

  limit: number;
}

export interface FeaturedProductsData {
  eyebrow: string;
  title: string;

  limit: number;
  ctaLabel?: string;
  ctaHref?: string;
}

export type PromoCardTheme = 'magenta' | 'cyan';

export interface PromoCard {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  metaText?: string;
  theme: PromoCardTheme;
}

export interface PromoBannerData {

  cards: PromoCard[];
}

export interface HowItWorksStep {
  number: string;
  title: string;
  description: string;
}

export interface HowItWorksData {
  eyebrow: string;
  title: string;

  steps: HowItWorksStep[];
}

export interface ReviewsData {
  eyebrow: string;
  title: string;

  limit: number;
}

export interface FaqData {
  eyebrow: string;
  title: string;

  pageSlug: string;

  limit?: number;
}

export interface CustomQuoteStep {
  number: string;
  title: string;
  description: string;
}

export interface CustomQuoteData {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;

  steps: CustomQuoteStep[];
}

export interface NewsletterData {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
}

export type TrustBadgeIcon = 'shipping' | 'shield' | 'discount' | 'age';

export interface TrustBadge {
  icon: TrustBadgeIcon;
  title: string;
  description: string;
}

export interface TrustStripData {

  badges: TrustBadge[];
}

export interface BlockDataByType {
  'hero-carousel': HeroCarouselData;
  'categories-strip': CategoriesStripData;
  'latest-products': LatestProductsData;
  'featured-products': FeaturedProductsData;
  'promo-banner': PromoBannerData;
  'how-it-works': HowItWorksData;
  reviews: ReviewsData;
  faq: FaqData;
  'custom-quote': CustomQuoteData;
  newsletter: NewsletterData;
  'trust-strip': TrustStripData;
}

export interface HomeBlock<T extends BlockType = BlockType> {

  id: string;
  type: T;

  order: number;

  isActive: boolean;
  data: BlockDataByType[T];
}

export type AnyHomeBlock = {
  [K in BlockType]: HomeBlock<K>;
}[BlockType];

export interface HomeBlocksConfig {
  blocks: AnyHomeBlock[];
}

export const HOME_BLOCKS_CACHE_KEYS = {
  config: 'cache:site:home-blocks',
  hydrated: 'cache:site:home-blocks:hydrated',
} as const;

export const HOME_BLOCKS_CACHE_KEY = HOME_BLOCKS_CACHE_KEYS.config;

export const LIMITS = {

  maxBlocks: 50,

  shortText: 200,

  longText: 500,

  href: 500,

  autoplayMs: { min: 3_000, max: 30_000 },

  latestProducts: { min: 1, max: 12, default: 4 },
  featuredProducts: { min: 1, max: 16, default: 8 },
  reviews: { min: 1, max: 12, default: 3 },
  faqLimit: { min: 1, max: 50, default: 6 },

  promoCards: { min: 1, max: 2 },

  steps: { count: 4 },

  trustBadges: { min: 1, max: 6 },
} as const;

export async function invalidateHomeBlocksCaches(
  redis: { del: (key: string) => Promise<unknown> },
  logger?: { warn: (msg: string) => void },
): Promise<void> {
  try {
    await Promise.all([
      redis.del(HOME_BLOCKS_CACHE_KEYS.config),
      redis.del(HOME_BLOCKS_CACHE_KEYS.hydrated),
    ]);
  } catch (err) {
    logger?.warn(
      `Failure invalidating home-blocks cache: ${(err as Error).message}`,
    );
  }
}

export function isBlockType(value: unknown): value is BlockType {
  return (
    typeof value === 'string' &&
    (BLOCK_TYPES as readonly string[]).includes(value)
  );
}

export function isBlockOfType<T extends BlockType>(
  block: AnyHomeBlock,
  type: T,
): block is Extract<AnyHomeBlock, { type: T }> {
  return block.type === type;
}
