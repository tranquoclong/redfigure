import { Test, TestingModule } from '@nestjs/testing';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('WishlistService', () => {
  let service: WishlistService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        {
          provide: PrismaService,
          useValue: {
            wishlistItem: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
            },

            $transaction: jest.fn().mockImplementation((cb) =>
              typeof cb === 'function'
                ? cb({
                    wishlistItem: {
                      count: jest.fn().mockResolvedValue(0),
                      create: jest.fn().mockImplementation(async (args) => ({
                        id: 'wl-1',
                        ...args.data,
                      })),
                    },
                  })
                : Promise.all(cb),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    it('should return wishlist items with product data', async () => {
      (prisma.wishlistItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'w1',
          userId: 'user1',
          productId: 'prod1',
          product: { id: 'prod1', name: 'Warrior', basePrice: 49.9 },
        },
      ]);

      const result = await service.findAll('user1');

      expect(result).toHaveLength(1);
      expect(result[0].product.name).toBe('Warrior');
    });
  });

  describe('findAllForAdmin', () => {
    it('uses explicit SELECT (anti-data leak — Gemini R1) and orders by desc', async () => {
      (prisma.wishlistItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'w1',
          productId: 'p1',
          createdAt: new Date(),
          product: {
            id: 'p1',
            name: 'Warrior',
            slug: 'warrior',
            basePrice: 49.9,
            salePrice: null,
            images: [
              {
                id: 'img1',
                mediaFile: {
                  id: 'mf1',
                  card: 'https://cdn.example/w-card.webp',
                  thumb: 'https://cdn.example/w-thumb.webp',
                },
              },
            ],
          },
        },
      ]);

      await service.findAllForAdmin('user1');

      expect(prisma.wishlistItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user1' },

          select: expect.objectContaining({
            id: true,
            productId: true,
            createdAt: true,
            product: expect.objectContaining({
              select: expect.objectContaining({
                id: true,
                name: true,
                slug: true,
                basePrice: true,
                salePrice: true,
                images: expect.objectContaining({
                  where: { isMain: true },
                  take: 1,
                }),
              }),
            }),
          }),
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('user without favorites returns []', async () => {
      (prisma.wishlistItem.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.findAllForAdmin('user1');
      expect(result).toEqual([]);
    });

    it('does NOT return stock/reservedStock in product shape (defense-in-depth)', async () => {

      (prisma.wishlistItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'w1',
          productId: 'p1',
          product: {
            id: 'p1',
            name: 'X',
            slug: 'x',
            basePrice: 10,
            salePrice: null,
            images: [],
          },
        },
      ]);
      const result = await service.findAllForAdmin('user1');
      expect(result[0].product).not.toHaveProperty('stock');
      expect(result[0].product).not.toHaveProperty('reservedStock');
    });
  });

  describe('add', () => {
    it('should add product to wishlist', async () => {
      (prisma.wishlistItem.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.wishlistItem.create as jest.Mock).mockResolvedValue({
        id: 'w1',
        userId: 'user1',
        productId: 'prod1',
      });

      const result = await service.add('user1', 'prod1');

      expect(result.productId).toBe('prod1');
    });

    it('should throw ConflictException if already in wishlist', async () => {
      (prisma.wishlistItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'w1',
        userId: 'user1',
        productId: 'prod1',
      });

      await expect(service.add('user1', 'prod1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should remove product from wishlist', async () => {
      (prisma.wishlistItem.delete as jest.Mock).mockResolvedValue({});

      await service.remove('user1', 'prod1');

      expect(prisma.wishlistItem.delete).toHaveBeenCalledWith({
        where: { userId_productId: { userId: 'user1', productId: 'prod1' } },
      });
    });
  });
});
