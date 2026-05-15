import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BannersService } from '../banners/banners.service';
import { FeaturedCategoriesService } from '../featured-categories/featured-categories.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AnyHomeBlock, BlockType } from './home-blocks.types';

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

export interface AggregatedProductImage {
  card: string;
  full: string;
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

const EMPTY_PAYLOAD: AggregatedHomePayload = {
  banners: [],
  featuredCategories: [],
  latestProducts: [],
  featuredProducts: [],
  faqItemsBySlug: {},
  highlightedReviews: [],
};

interface BlockNeeds {
  hasHero: boolean;
  hasCategories: boolean;
  latestLimit: number;
  featuredLimit: number;
  reviewsLimit: number;
  faqSlugs: Set<string>;
}

function analyzeBlocks(blocks: AnyHomeBlock[]): BlockNeeds {
  const needs: BlockNeeds = {
    hasHero: false,
    hasCategories: false,
    latestLimit: 0,
    featuredLimit: 0,
    reviewsLimit: 0,
    faqSlugs: new Set(),
  };
  for (const block of blocks) {
    if (!block.isActive) continue;
    switch (block.type) {
      case 'hero-carousel':
        needs.hasHero = true;
        break;
      case 'categories-strip':
        needs.hasCategories = true;
        break;
      case 'latest-products':
        needs.latestLimit = Math.max(needs.latestLimit, block.data.limit);
        break;
      case 'featured-products':
        needs.featuredLimit = Math.max(needs.featuredLimit, block.data.limit);
        break;
      case 'reviews':
        needs.reviewsLimit = Math.max(needs.reviewsLimit, block.data.limit);
        break;
      case 'faq':
        needs.faqSlugs.add(block.data.pageSlug);
        break;
      default:

        break;
    }
  }
  return needs;
}

@Injectable()
export class HomeBlocksAggregator {
  private readonly logger = new Logger(HomeBlocksAggregator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly banners: BannersService,
    private readonly featuredCategories: FeaturedCategoriesService,
    private readonly reviews: ReviewsService,
  ) {}

  async aggregate(blocks: AnyHomeBlock[]): Promise<AggregatedHomePayload> {
    const needs = analyzeBlocks(blocks);

    const [
      bannersResult,
      categoriesResult,
      latestResult,
      featuredResult,
      reviewsResult,
      faqResult,
    ] = await Promise.allSettled([
      needs.hasHero
        ? this.fetchBanners()
        : Promise.resolve([] as AggregatedBanner[]),
      needs.hasCategories
        ? this.fetchFeaturedCategories()
        : Promise.resolve([] as AggregatedCategory[]),
      needs.latestLimit > 0
        ? this.fetchLatestProducts(needs.latestLimit)
        : Promise.resolve([] as AggregatedProduct[]),
      needs.featuredLimit > 0
        ? this.fetchFeaturedProducts(needs.featuredLimit)
        : Promise.resolve([] as AggregatedProduct[]),
      needs.reviewsLimit > 0
        ? this.fetchHighlightedReviews(needs.reviewsLimit)
        : Promise.resolve([] as AggregatedHighlightedReview[]),
      needs.faqSlugs.size > 0
        ? this.fetchFaqs(Array.from(needs.faqSlugs))
        : Promise.resolve({} as Record<string, AggregatedFaqItem[]>),
    ]);

    return {
      banners: this.unwrap(bannersResult, 'banners', []),
      featuredCategories: this.unwrap(
        categoriesResult,
        'featuredCategories',
        [],
      ),
      latestProducts: this.unwrap(latestResult, 'latestProducts', []),
      featuredProducts: this.unwrap(featuredResult, 'featuredProducts', []),
      highlightedReviews: this.unwrap(reviewsResult, 'highlightedReviews', []),
      faqItemsBySlug: this.unwrap(faqResult, 'faqItemsBySlug', {}),
    };
  }

  private unwrap<T>(
    result: PromiseSettledResult<T>,
    label: string,
    fallback: T,
  ): T {
    if (result.status === 'fulfilled') return result.value;
    this.logger.warn(
      `home-blocks aggregator: ${label} falhou — ${(result.reason as Error)?.message ?? 'unknown'}`,
    );
    return fallback;
  }

  private async fetchBanners(): Promise<AggregatedBanner[]> {
    const banners = await this.banners.findActive();
    return banners.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? null,
      eyebrow: b.eyebrow ?? null,
      primaryCtaLabel: b.primaryCtaLabel ?? null,
      primaryCtaHref: b.primaryCtaHref ?? null,
      secondaryCtaLabel: b.secondaryCtaLabel ?? null,
      secondaryCtaHref: b.secondaryCtaHref ?? null,
      imageUrl: b.imageUrl ?? null,
      order: b.order,
    }));
  }

  private async fetchFeaturedCategories(): Promise<AggregatedCategory[]> {
    const featured = await this.featuredCategories.findActive();
    if (featured.length === 0) return [];

    const categoryIds = featured.map((f) => f.categoryId);
    const counts = await this.prisma.productCategory.groupBy({
      by: ['categoryId'],
      where: {
        categoryId: { in: categoryIds },
        product: { isActive: true },
      },
      _count: { productId: true },
    });
    const countMap = new Map(
      counts.map((c) => [c.categoryId, c._count.productId]),
    );

    return featured.map((f) => ({
      id: f.id,
      categoryId: f.categoryId,
      slug: f.category.slug,
      name: f.category.name,
      displayLabel: f.displayLabel ?? null,
      glowColor: f.glowColor ?? null,
      productCount: countMap.get(f.categoryId) ?? 0,
      order: f.order,
    }));
  }

  private async fetchLatestProducts(
    limit: number,
  ): Promise<AggregatedProduct[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        brand: { select: { name: true } },
        images: {
          select: {
            isMain: true,
            order: true,
            mediaFile: { select: { card: true, full: true } },
          },
          orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
          take: 1,
        },
      },
    });
    return Promise.all(products.map((p) => this.toAggregatedProduct(p)));
  }

  private async fetchFeaturedProducts(
    limit: number,
  ): Promise<AggregatedProduct[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, featured: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        brand: { select: { name: true } },
        images: {
          select: {
            isMain: true,
            order: true,
            mediaFile: { select: { card: true, full: true } },
          },
          orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
          take: 1,
        },
      },
    });
    return Promise.all(products.map((p) => this.toAggregatedProduct(p)));
  }

  private async toAggregatedProduct(p: {
    id: string;
    slug: string;
    name: string;
    shortDescription: string | null;
    basePrice: number;
    salePrice: number | null;
    displayPrice: number;
    featured: boolean;
    brand: { name: string } | null;
    images: Array<{
      mediaFile: { card: string; full: string } | null;
    }>;
  }): Promise<AggregatedProduct> {
    const stats = await this.reviews
      .getAverageRating(p.id)
      .catch(() => ({ average: 0, count: 0 }));

    const firstImage = p.images[0]?.mediaFile;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      basePrice: p.basePrice,
      salePrice: p.salePrice,
      displayPrice: p.displayPrice,
      featured: p.featured,
      brandName: p.brand?.name ?? null,
      image: firstImage
        ? { card: firstImage.card, full: firstImage.full }
        : null,
      averageRating: stats.average,
      reviewCount: stats.count,
    };
  }

  private async fetchHighlightedReviews(
    limit: number,
  ): Promise<AggregatedHighlightedReview[]> {
    const rows = await this.reviews.findHighlighted({ limit });
    return rows.map((r) => {
      const firstImage = r.product.images[0]?.mediaFile ?? null;
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        displayName: r.displayName,
        authorName: r.user?.name ?? null,
        product: {
          id: r.product.id,
          slug: r.product.slug,
          name: r.product.name,
          image: firstImage
            ? { card: firstImage.card, full: firstImage.full }
            : null,
        },
      };
    });
  }

  private async fetchFaqs(
    slugs: string[],
  ): Promise<Record<string, AggregatedFaqItem[]>> {
    const pages = await this.prisma.page.findMany({
      where: {
        slug: { in: slugs },
        isPublished: true,
      },
      select: { slug: true, faqItems: true },
    });
    const result: Record<string, AggregatedFaqItem[]> = {};
    for (const slug of slugs) result[slug] = [];
    for (const page of pages) {
      const raw = page.faqItems;
      if (!Array.isArray(raw)) continue;
      const validItems: AggregatedFaqItem[] = [];
      for (const item of raw) {
        if (
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { question?: unknown }).question === 'string' &&
          typeof (item as { answer?: unknown }).answer === 'string'
        ) {
          const q = item as { question: string; answer: string };
          validItems.push({ question: q.question, answer: q.answer });
        }
      }
      result[page.slug] = validItems;
    }
    return result;
  }

  static empty(): AggregatedHomePayload {
    return EMPTY_PAYLOAD;
  }

  static types() {
    return {

    } as {
      banner: AggregatedBanner;
      block: AnyHomeBlock;
      blockType: BlockType;
    };
  }
}
