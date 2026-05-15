import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: PrismaService;
  let redis: { del: jest.Mock };

  beforeEach(async () => {
    redis = { del: jest.fn().mockResolvedValue(1) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: {
            review: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn().mockResolvedValue(null),
              update: jest.fn(),
              count: jest.fn(),
              aggregate: jest.fn(),
              groupBy: jest.fn(),
            },
            order: {
              findUnique: jest.fn(),
            },
            coupon: {
              create: jest.fn(),
            },
            reviewReward: {
              create: jest.fn(),
              findFirst: jest.fn().mockResolvedValue(null),
            },

            $transaction: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: redis,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get<PrismaService>(PrismaService);

    (
      prisma as unknown as { $transaction: jest.Mock }
    ).$transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
    );
  });

  describe('create', () => {
    it('should create review for DELIVERED order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        items: [{ productId: 'prod1' }],
      });
      (prisma.review.create as jest.Mock).mockResolvedValue({
        id: 'rev1',
        productId: 'prod1',
        userId: 'user1',
        orderId: 'order1',
        rating: 5,
        comment: 'Excellent!',
      });

      const result = await service.create({
        userId: 'user1',
        productId: 'prod1',
        orderId: 'order1',
        rating: 5,
        comment: 'Excellent!',
      });

      expect(result.rating).toBe(5);
    });

    it('rejects duplicate review (same user+product+order)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        items: [{ productId: 'prod1' }],
      });
      (prisma.review.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'existing-review',
      });

      await expect(
        service.create({
          userId: 'user1',
          productId: 'prod1',
          orderId: 'order1',
          rating: 1,
          comment: 'rating manipulation attempt',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('Direct POST /reviews does NOT accept mediaFileIds (IDOR surface closed)', async () => {

      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        items: [{ productId: 'prod1' }],
      });
      (prisma.review.create as jest.Mock).mockResolvedValue({ id: 'r1' });

      await service.create({
        userId: 'user1',
        productId: 'prod1',
        orderId: 'order1',
        rating: 5,
      });

      const call = (prisma.review.create as jest.Mock).mock.calls[0][0];
      expect(call.data).not.toHaveProperty('images');
    });

    it('should reject review if order is NOT DELIVERED', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'user1',
        status: 'PROCESSING',
        items: [{ productId: 'prod1' }],
      });

      await expect(
        service.create({
          userId: 'user1',
          productId: 'prod1',
          orderId: 'order1',
          rating: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject review if order does not belong to user', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'other-user',
        status: 'DELIVERED',
        items: [{ productId: 'prod1' }],
      });

      await expect(
        service.create({
          userId: 'user1',
          productId: 'prod1',
          orderId: 'order1',
          rating: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject review if product was not in the order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        items: [{ productId: 'other-product' }],
      });

      await expect(
        service.create({
          userId: 'user1',
          productId: 'prod1',
          orderId: 'order1',
          rating: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject rating outside 1-5', async () => {
      await expect(
        service.create({
          userId: 'user1',
          productId: 'prod1',
          orderId: 'order1',
          rating: 6,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByProduct', () => {
    it('should return only approved reviews', async () => {
      (prisma.review.findMany as jest.Mock).mockResolvedValue([
        { id: 'rev1', rating: 5, comment: 'Top', user: { name: 'John' } },
      ]);

      const result = await service.findByProduct('prod1');

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod1', isApproved: true },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getAverageRating', () => {
    it('should return average rating for a product', async () => {
      (prisma.review.aggregate as jest.Mock).mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 10 },
      });

      const result = await service.getAverageRating('prod1');

      expect(result.average).toBe(4.5);
      expect(result.count).toBe(10);
    });

    it('should return 0 if no reviews', async () => {
      (prisma.review.aggregate as jest.Mock).mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });

      const result = await service.getAverageRating('prod1');

      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe('getRatingDistribution', () => {
    it('fills all 5 keys even with gaps in groupBy', async () => {
      (prisma.review.groupBy as jest.Mock).mockResolvedValue([
        { rating: 5, _count: { rating: 12 } },
        { rating: 4, _count: { rating: 8 } },
        { rating: 1, _count: { rating: 1 } },
      ]);
      const result = await service.getRatingDistribution('prod1');
      expect(result).toEqual({ '5': 12, '4': 8, '3': 0, '2': 0, '1': 1 });
    });

    it('returns zero-fill when product has no review', async () => {
      (prisma.review.groupBy as jest.Mock).mockResolvedValue([]);
      const result = await service.getRatingDistribution('prod1');
      expect(result).toEqual({ '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 });
    });

    it('filters by isApproved=true (only approved reviews)', async () => {
      (prisma.review.groupBy as jest.Mock).mockResolvedValue([]);
      await service.getRatingDistribution('prod1');
      expect(prisma.review.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod1', isApproved: true },
        }),
      );
    });
  });

  describe('approve', () => {
    it('should set isApproved to true', async () => {
      (prisma.review.update as jest.Mock).mockResolvedValue({
        id: 'rev1',
        isApproved: true,
      });

      const result = await service.approve('rev1');

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev1' },
        data: { isApproved: true },
      });
      expect(result.isApproved).toBe(true);
    });
  });

  describe('generateReward', () => {
    it('should create coupon and link to review', async () => {
      (prisma.coupon.create as jest.Mock).mockResolvedValue({
        id: 'coupon1',
        code: expect.any(String),
      });
      (prisma.reviewReward.create as jest.Mock).mockResolvedValue({
        id: 'rr1',
        reviewId: 'rev1',
        couponId: 'coupon1',
      });

      const result = await service.generateReward('rev1', 'user1');

      expect(prisma.coupon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PERCENTAGE',
          value: 5,
          usesPerUser: 1,
          isActive: true,
        }),
      });
      expect(result.couponId).toBe('coupon1');
    });
  });

  describe('findHighlighted', () => {
    it('filters isApproved=true and isHighlightedOnHome=true', async () => {
      (prisma.review.findMany as jest.Mock).mockResolvedValue([]);
      await service.findHighlighted();
      const args = (prisma.review.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where).toEqual({
        isApproved: true,
        isHighlightedOnHome: true,
      });
    });

    it('orders by createdAt desc', async () => {
      (prisma.review.findMany as jest.Mock).mockResolvedValue([]);
      await service.findHighlighted();
      const args = (prisma.review.findMany as jest.Mock).mock.calls[0][0];
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('cap on limit (default 3, max 12)', async () => {
      (prisma.review.findMany as jest.Mock).mockResolvedValue([]);

      await service.findHighlighted();
      expect((prisma.review.findMany as jest.Mock).mock.calls[0][0].take).toBe(
        3,
      );

      await service.findHighlighted({ limit: 100 });
      expect((prisma.review.findMany as jest.Mock).mock.calls[1][0].take).toBe(
        12,
      );

      await service.findHighlighted({ limit: 0 });
      expect((prisma.review.findMany as jest.Mock).mock.calls[2][0].take).toBe(
        1,
      );

      await service.findHighlighted({ limit: 7.9 });
      expect((prisma.review.findMany as jest.Mock).mock.calls[3][0].take).toBe(
        7,
      );
    });

    it('include brings product + main image (isMain first)', async () => {
      (prisma.review.findMany as jest.Mock).mockResolvedValue([]);
      await service.findHighlighted();
      const args = (prisma.review.findMany as jest.Mock).mock.calls[0][0];
      expect(args.include.product.select).toMatchObject({
        id: true,
        slug: true,
        name: true,
      });
      expect(args.include.product.select.images.orderBy).toEqual([
        { isMain: 'desc' },
        { order: 'asc' },
      ]);
      expect(args.include.product.select.images.take).toBe(1);
    });
  });

  describe('setHighlightedOnHome', () => {
    it('toggle on in APPROVED review persists + invalidates cache', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue({
        id: 'r1',
        isApproved: true,
      });
      (prisma.review.update as jest.Mock).mockResolvedValue({
        id: 'r1',
        isHighlightedOnHome: true,
      });
      const result = await service.setHighlightedOnHome('r1', true);
      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { isHighlightedOnHome: true },
      });
      expect(redis.del).toHaveBeenCalledWith('cache:site:home-blocks');
      expect(result.isHighlightedOnHome).toBe(true);
    });

    it('rejects 422 when review is NOT approved and isHighlighted=true', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue({
        id: 'r1',
        isApproved: false,
      });
      await expect(service.setHighlightedOnHome('r1', true)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(prisma.review.update).not.toHaveBeenCalled();
    });

    it('allows OFF (false) even in unapproved review (cleanup)', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue({
        id: 'r1',
        isApproved: false,
      });
      (prisma.review.update as jest.Mock).mockResolvedValue({
        id: 'r1',
        isHighlightedOnHome: false,
      });
      await service.setHighlightedOnHome('r1', false);
      expect(prisma.review.update).toHaveBeenCalled();
    });

    it('rejects 404 when review does not exist', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.setHighlightedOnHome('missing', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('Redis failure does NOT bring down the PATCH (fail-soft)', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue({
        id: 'r1',
        isApproved: true,
      });
      (prisma.review.update as jest.Mock).mockResolvedValue({
        id: 'r1',
        isHighlightedOnHome: true,
      });
      redis.del.mockRejectedValueOnce(new Error('redis down'));
      await expect(
        service.setHighlightedOnHome('r1', true),
      ).resolves.toBeDefined();
    });
  });
});
