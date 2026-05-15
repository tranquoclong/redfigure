import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FreeGiftsService } from './free-gifts.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('FreeGiftsService', () => {
  let service: FreeGiftsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FreeGiftsService,
        {
          provide: PrismaService,
          useValue: {
            freeGift: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            product: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            getJson: jest.fn().mockResolvedValue(null),
            setJson: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<FreeGiftsService>(FreeGiftsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  function baseGift(overrides: Record<string, unknown> = {}) {
    return {
      id: 'gift1',
      isActive: true,
      minOrderAmount: 100,
      productId: 'prod1',
      startsAt: null,
      endsAt: null,
      label: '🎁 Free gift!',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      product: {
        id: 'prod1',
        name: 'Mini gift',
        slug: 'mini-brinde',
        type: 'simple',
        isActive: true,
        isDraft: false,
        images: [{ mediaFile: { thumb: 'thumb.webp', card: 'card.webp' } }],
      },
      ...overrides,
    };
  }

  function baseProduct(overrides: Record<string, unknown> = {}) {
    return {
      id: 'prod1',
      name: 'Mini brinde',
      slug: 'mini-brinde',
      type: 'simple',
      isActive: true,
      isDraft: false,
      ...overrides,
    };
  }

  describe('getActiveGift', () => {
    it('1. Returns null when there is no active gift.', async () => {
      (prisma.freeGift.findMany as jest.Mock).mockResolvedValue([]);
      const r = await service.getActiveGift();
      expect(r).toBeNull();
    });

    it('2. Returns the gift when it is within the period and isActive=true', async () => {
      const now = new Date('2026-05-03T12:00:00Z');
      (prisma.freeGift.findMany as jest.Mock).mockResolvedValue([
        baseGift({
          startsAt: new Date('2026-05-01'),
          endsAt: new Date('2026-05-31'),
        }),
      ]);
      const r = await service.getActiveGift(now);
      expect(r).not.toBeNull();
      expect(r?.id).toBe('gift1');
    });

    it('3. Returns null when the period has expired (endsAt in the past)', async () => {
      const now = new Date('2026-05-03T12:00:00Z');

      (prisma.freeGift.findMany as jest.Mock).mockResolvedValue([]);
      const r = await service.getActiveGift(now);
      expect(r).toBeNull();

      const callArgs = (prisma.freeGift.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.isActive).toBe(true);
      expect(callArgs.where.AND).toBeDefined();
    });

    it('4. Returns null when isActive=false (filter in WHERE)', async () => {
      (prisma.freeGift.findMany as jest.Mock).mockResolvedValue([]);
      const r = await service.getActiveGift();
      expect(r).toBeNull();
      const callArgs = (prisma.freeGift.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.isActive).toBe(true);
    });

    it('5. Returns the one with the highest minOrderAmount when there are two active ones simultaneously', async () => {
      (prisma.freeGift.findMany as jest.Mock).mockResolvedValue([
        baseGift({ id: 'gift-low', minOrderAmount: 50 }),
        baseGift({ id: 'gift-high', minOrderAmount: 200 }),
        baseGift({ id: 'gift-mid', minOrderAmount: 100 }),
      ]);
      const r = await service.getActiveGift();
      expect(r?.id).toBe('gift-high');
    });

    it('5b. Tie in minOrderAmount: the most recent one wins (createdAt DESC)', async () => {
      (prisma.freeGift.findMany as jest.Mock).mockResolvedValue([
        baseGift({
          id: 'gift-old',
          minOrderAmount: 100,
          createdAt: new Date('2026-01-01'),
        }),
        baseGift({
          id: 'gift-new',
          minOrderAmount: 100,
          createdAt: new Date('2026-04-01'),
        }),
      ]);
      const r = await service.getActiveGift();
      expect(r?.id).toBe('gift-new');
    });
  });

  describe('create', () => {
    it('6. Throws BadRequestException if endsAt < startsAt', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(baseProduct());
      await expect(
        service.create({
          minOrderAmount: 100,
          productId: 'prod1',
          startsAt: new Date('2026-05-31'),
          endsAt: new Date('2026-05-01'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. Throws NotFoundException if productId does not exist', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.create({ minOrderAmount: 100, productId: 'fake' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('8. Throws BadRequestException if product is inactive', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        baseProduct({ isActive: false }),
      );
      await expect(
        service.create({ minOrderAmount: 100, productId: 'prod1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('8b. Throws BadRequestException if product is variable (requires simple)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        baseProduct({ type: 'variable' }),
      );
      await expect(
        service.create({ minOrderAmount: 100, productId: 'prod1' }),
      ).rejects.toThrow(/simple/i);
    });

    it('8c. Throws BadRequestException if product is bundle', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        baseProduct({ type: 'bundle' }),
      );
      await expect(
        service.create({ minOrderAmount: 100, productId: 'prod1' }),
      ).rejects.toThrow(/simple/i);
    });

    it('9. Creates the gift with defaults when data is valid', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(baseProduct());
      (prisma.freeGift.create as jest.Mock).mockResolvedValue(baseGift());
      const r = await service.create({
        minOrderAmount: 150,
        productId: 'prod1',
      });
      expect(prisma.freeGift.create).toHaveBeenCalled();
      expect(r.id).toBe('gift1');
    });
  });

  describe('update', () => {
    it('10. Throws BadRequestException if endsAt < startsAt', async () => {
      (prisma.freeGift.findUnique as jest.Mock).mockResolvedValue(baseGift());
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(baseProduct());
      await expect(
        service.update('gift1', {
          startsAt: new Date('2026-12-01'),
          endsAt: new Date('2026-06-01'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('11. Throws NotFoundException if gift does not exist', async () => {
      (prisma.freeGift.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.update('fake', { minOrderAmount: 200 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('12. Throws NotFoundException if gift does not exist', async () => {
      (prisma.freeGift.delete as jest.Mock).mockRejectedValue({
        code: 'P2025',
      });
      await expect(service.remove('fake')).rejects.toThrow(NotFoundException);
    });
  });
});
