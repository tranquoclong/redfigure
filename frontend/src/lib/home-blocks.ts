

import { API_URL } from '@/lib/constants';

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

export interface AggregatedProductImage {
  card: string;
  full: string;
}

export interface AggregatedBanner {
  id: string;
  title: string;
  subtitle: string | null;
  eyebrow: string | null;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  imageUrl: string | null;
  order: number;
}

export interface AggregatedCategory {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  displayLabel: string | null;
  glowColor: string | null;
  productCount: number;
  order: number;
}

export interface AggregatedProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  salePrice: number | null;
  displayPrice: number;
  featured: boolean;
  brandName: string | null;
  image: AggregatedProductImage | null;
  averageRating: number;
  reviewCount: number;
}

export interface AggregatedFaqItem {
  question: string;
  answer: string;
}

export interface AggregatedHighlightedReview {
  id: string;
  rating: number;
  comment: string | null;
  displayName: string | null;
  authorName: string | null;
  product: {
    id: string;
    slug: string;
    name: string;
    image: AggregatedProductImage | null;
  };
}

export interface AggregatedHomePayload {
  banners: AggregatedBanner[];
  featuredCategories: AggregatedCategory[];
  latestProducts: AggregatedProduct[];
  featuredProducts: AggregatedProduct[];
  faqItemsBySlug: Record<string, AggregatedFaqItem[]>;
  highlightedReviews: AggregatedHighlightedReview[];
}

export interface HomeBlocksResponse {
  blocks: AnyHomeBlock[];
  aggregated: AggregatedHomePayload;
}

const EMPTY_AGGREGATED: AggregatedHomePayload = {
  banners: [],
  featuredCategories: [],
  latestProducts: [],
  featuredProducts: [],
  faqItemsBySlug: {},
  highlightedReviews: [],
};

export const HOME_BLOCKS_CACHE_TAG = 'site:home-blocks';

export async function getHomeBlocks(): Promise<HomeBlocksResponse> {
  try {
    const res = await fetch(`${API_URL}/api/v1/site/home-blocks`, {
      next: { revalidate: 300, tags: [HOME_BLOCKS_CACHE_TAG] },
    });
    if (!res.ok) {
      return { blocks: [], aggregated: EMPTY_AGGREGATED };
    }
    const json = (await res.json()) as unknown;
    return parseHomeBlocksResponse(json);
  } catch {
    return { blocks: [], aggregated: EMPTY_AGGREGATED };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlockType(value: unknown): value is BlockType {
  return (
    typeof value === 'string' && (BLOCK_TYPES as readonly string[]).includes(value)
  );
}

function parseHomeBlocksResponse(raw: unknown): HomeBlocksResponse {
  if (!isRecord(raw)) return { blocks: [], aggregated: EMPTY_AGGREGATED };
  const data = raw.data;
  if (!isRecord(data)) return { blocks: [], aggregated: EMPTY_AGGREGATED };

  const blocks: AnyHomeBlock[] = [];
  if (Array.isArray(data.blocks)) {
    for (const item of data.blocks) {
      if (!isRecord(item)) continue;
      if (typeof item.id !== 'string' || item.id.length === 0) continue;
      if (!isBlockType(item.type)) continue;
      if (typeof item.order !== 'number' || !Number.isFinite(item.order)) continue;
      if (typeof item.isActive !== 'boolean') continue;
      if (!isRecord(item.data)) continue;
      blocks.push(item as unknown as AnyHomeBlock);
    }
  }

  const agg = isRecord(data.aggregated) ? data.aggregated : {};
  const aggregated: AggregatedHomePayload = {
    banners: Array.isArray(agg.banners)
      ? (agg.banners as AggregatedBanner[])
      : [],
    featuredCategories: Array.isArray(agg.featuredCategories)
      ? (agg.featuredCategories as AggregatedCategory[])
      : [],
    latestProducts: Array.isArray(agg.latestProducts)
      ? (agg.latestProducts as AggregatedProduct[])
      : [],
    featuredProducts: Array.isArray(agg.featuredProducts)
      ? (agg.featuredProducts as AggregatedProduct[])
      : [],
    faqItemsBySlug: isRecord(agg.faqItemsBySlug)
      ? (agg.faqItemsBySlug as Record<string, AggregatedFaqItem[]>)
      : {},
    highlightedReviews: Array.isArray(agg.highlightedReviews)
      ? (agg.highlightedReviews as AggregatedHighlightedReview[])
      : [],
  };

  return { blocks, aggregated };
}

export function isBlockOfType<T extends BlockType>(
  block: AnyHomeBlock,
  type: T,
): block is Extract<AnyHomeBlock, { type: T }> {
  return block.type === type;
}
