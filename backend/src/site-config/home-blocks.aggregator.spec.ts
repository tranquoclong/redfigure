import { Test, TestingModule } from '@nestjs/testing';
import { HomeBlocksAggregator } from './home-blocks.aggregator';
import { PrismaService } from '../prisma/prisma.service';
import { BannersService } from '../banners/banners.service';
import { FeaturedCategoriesService } from '../featured-categories/featured-categories.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AnyHomeBlock } from './home-blocks.types';

describe('HomeBlocksAggregator', () => {
  let agg: HomeBlocksAggregator;
  let banners: { findActive: jest.Mock };
  let featuredCategories: { findActive: jest.Mock };
  let reviews: {
    findHighlighted: jest.Mock;
    getAverageRating: jest.Mock;
  };
  let prisma: {
    product: { findMany: jest.Mock; groupBy: jest.Mock };
    productCategory: { groupBy: jest.Mock };
    page: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    banners = { findActive: jest.fn().mockResolvedValue([]) };
    featuredCategories = { findActive: jest.fn().mockResolvedValue([]) };
    reviews = {
      findHighlighted: jest.fn().mockResolvedValue([]),
      getAverageRating: jest.fn().mockResolvedValue({ average: 0, count: 0 }),
    };
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      productCategory: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      page: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeBlocksAggregator,
        { provide: PrismaService, useValue: prisma },
        { provide: BannersService, useValue: banners },
        { provide: FeaturedCategoriesService, useValue: featuredCategories },
        { provide: ReviewsService, useValue: reviews },
      ],
    }).compile();

    agg = module.get(HomeBlocksAggregator);
  });

  function block<T extends AnyHomeBlock['type']>(
    type: T,
    overrides: Partial<AnyHomeBlock> = {},
    data: unknown = {},
  ): AnyHomeBlock {
    return {
      id: `${type}-1`,
      type,
      order: 0,
      isActive: true,
      data,
      ...overrides,
    } as AnyHomeBlock;
  }

  it('does not consult banners when there is no active hero block', async () => {
    await agg.aggregate([
      block(
        'newsletter',
        {},
        {
          eyebrow: 'a',
          title: 'b',
          description: 'c',
          ctaLabel: 'd',
        },
      ),
    ]);
    expect(banners.findActive).not.toHaveBeenCalled();
  });

  it('consults banners when there is an active hero block', async () => {
    await agg.aggregate([block('hero-carousel', {}, { autoplayMs: 6000 })]);
    expect(banners.findActive).toHaveBeenCalledTimes(1);
  });

  it('does NOT consult banners if hero is inactive (isActive=false)', async () => {
    await agg.aggregate([
      block('hero-carousel', { isActive: false }, { autoplayMs: 6000 }),
    ]);
    expect(banners.findActive).not.toHaveBeenCalled();
  });

  it('aggregates maximum limit between multiple instances of the same type', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await agg.aggregate([
      block(
        'latest-products',
        { id: 'a' },
        {
          eyebrow: 'e',
          title: 't',
          limit: 4,
        },
      ),
      block(
        'latest-products',
        { id: 'b', order: 1 },
        {
          eyebrow: 'e',
          title: 't',
          limit: 8,
        },
      ),
    ]);

    const call = prisma.product.findMany.mock.calls[0]?.[0];
    expect(call.take).toBe(8);
  });

  it('failure in banners does NOT bring down the rest (Promise.allSettled)', async () => {
    banners.findActive.mockRejectedValue(new Error('redis down'));
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        slug: 'abc',
        name: 'Test',
        shortDescription: null,
        basePrice: 100,
        salePrice: null,
        displayPrice: 100,
        featured: true,
        brand: null,
        images: [],
      },
    ]);
    const result = await agg.aggregate([
      block('hero-carousel', {}, { autoplayMs: 6000 }),
      block(
        'featured-products',
        { id: 'fp', order: 1 },
        {
          eyebrow: 'e',
          title: 't',
          limit: 4,
        },
      ),
    ]);
    expect(result.banners).toEqual([]);
    expect(result.featuredProducts).toHaveLength(1);
  });

  it('failure in featured categories becomes an empty list (graceful)', async () => {
    featuredCategories.findActive.mockRejectedValue(new Error('boom'));
    const result = await agg.aggregate([
      block('categories-strip', {}, { eyebrow: 'a', title: 'b' }),
    ]);
    expect(result.featuredCategories).toEqual([]);
  });

  it('faqItemsBySlug groups by slug and ignores malformed items', async () => {
    prisma.page.findMany.mockResolvedValue([
      {
        slug: 'faq',
        faqItems: [
          { question: 'Q1', answer: 'A1' },
          { question: 'Q2' },
          'garbage string',
          { question: 'Q3', answer: 'A3' },
        ],
      },
    ]);
    const result = await agg.aggregate([
      block('faq', {}, { eyebrow: 'a', title: 'b', pageSlug: 'faq' }),
    ]);
    expect(result.faqItemsBySlug.faq).toEqual([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q3', answer: 'A3' },
    ]);
  });

  it('faq includes slug with empty array when page exists without faqItems', async () => {
    prisma.page.findMany.mockResolvedValue([{ slug: 'faq', faqItems: null }]);
    const result = await agg.aggregate([
      block('faq', {}, { eyebrow: 'a', title: 'b', pageSlug: 'faq' }),
    ]);
    expect(result.faqItemsBySlug.faq).toEqual([]);
  });

  it('highlightedReviews maps product image (isMain first)', async () => {
    reviews.findHighlighted.mockResolvedValue([
      {
        id: 'r1',
        rating: 5,
        comment: 'Great',
        displayName: 'Joe',
        user: { name: 'Joe Doe' },
        product: {
          id: 'p1',
          slug: 'abby',
          name: 'Abby',
          images: [
            {
              isMain: true,
              order: 1,
              mediaFile: { card: 'card.jpg', full: 'full.jpg' },
            },
          ],
        },
      },
    ]);
    const result = await agg.aggregate([
      block('reviews', {}, { eyebrow: 'a', title: 'b', limit: 3 }),
    ]);
    expect(result.highlightedReviews).toHaveLength(1);
    expect(result.highlightedReviews[0].product.image).toEqual({
      card: 'card.jpg',
      full: 'full.jpg',
    });
    expect(result.highlightedReviews[0].authorName).toBe('Joe Doe');
  });

  describe('featured products — count and filter', () => {
    it('respects the block `limit` and passes take to Prisma', async () => {
      const mockProducts = Array.from({ length: 8 }, (_, i) => ({
        id: `p${i + 1}`,
        slug: `prod-${i + 1}`,
        name: `Product ${i + 1}`,
        shortDescription: null,
        basePrice: 100,
        salePrice: null,
        displayPrice: 100,
        featured: true,
        brand: null,
        images: [],
      }));
      prisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await agg.aggregate([
        block('featured-products', {}, { eyebrow: 'e', title: 't', limit: 8 }),
      ]);

      const findManyCall = prisma.product.findMany.mock.calls[0]?.[0];

      expect(findManyCall.take).toBe(8);
      expect(findManyCall.where).toMatchObject({
        isActive: true,
        featured: true,
      });
      expect(result.featuredProducts).toHaveLength(8);
    });

    it('filters only products with featured=true (where condition)', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await agg.aggregate([
        block('featured-products', {}, { eyebrow: 'e', title: 't', limit: 4 }),
      ]);
      const call = prisma.product.findMany.mock.calls[0]?.[0];
      expect(call.where.featured).toBe(true);
      expect(call.where.isActive).toBe(true);
    });

    it('when there are fewer featured products in the DB than requested limit, returns what exists', async () => {

      prisma.product.findMany.mockResolvedValue(
        Array.from({ length: 3 }, (_, i) => ({
          id: `p${i + 1}`,
          slug: `s${i + 1}`,
          name: `N${i + 1}`,
          shortDescription: null,
          basePrice: 100,
          salePrice: null,
          displayPrice: 100,
          featured: true,
          brand: null,
          images: [],
        })),
      );
      const result = await agg.aggregate([
        block('featured-products', {}, { eyebrow: 'e', title: 't', limit: 8 }),
      ]);
      expect(result.featuredProducts).toHaveLength(3);
    });
  });
});
