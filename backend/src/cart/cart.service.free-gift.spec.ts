import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CartService } from './cart.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';
import { CustomQuotesService } from '../custom-quotes/custom-quotes.service';
import { FreeGiftsService } from '../free-gifts/free-gifts.service';
import { ProductsService } from '../products/products.service';

describe('CartService — sync free gift', () => {
  let service: CartService;
  let redis: any;
  let prisma: any;
  let freeGiftsService: any;

  const userId = 'cuserabcdefghijklmnopqrst';

  let redisStore: Record<string, unknown>;

  function activeGift(over: Record<string, unknown> = {}) {
    return {
      id: 'cgift00000000000000000001',
      minOrderAmount: 100,
      label: '🎁 Free Gift!',
      product: {
        id: 'cgiftprod000000000000000a',
        name: 'Mini Gift',
        slug: 'mini-gift',
        image: 'thumb.webp',
      },
      ...over,
    };
  }

  function cartItem(over: Record<string, unknown> = {}) {
    return {
      productId: 'cprod00000000000000000001',
      quantity: 2,
      price: 50,
      name: 'product X',
      ...over,
    };
  }

  function giftItem(over: Record<string, unknown> = {}) {
    return {
      productId: 'cgiftprod000000000000000a',
      quantity: 1,
      price: 0,
      name: 'Mini Gift',
      isFreeGift: true,
      freeGiftId: 'cgift00000000000000000001',
      ...over,
    };
  }

  beforeEach(async () => {
    redisStore = {};
    redis = {
      getJson: jest.fn((key: string) =>
        Promise.resolve(redisStore[key] ?? null),
      ),
      setJson: jest.fn((key: string, value: unknown) => {
        redisStore[key] = value;
        return Promise.resolve();
      }),
      del: jest.fn((key: string) => {
        delete redisStore[key];
        return Promise.resolve();
      }),
    };

    freeGiftsService = {
      getActiveGift: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: RedisService, useValue: redis },
        {
          provide: PrismaService,
          useValue: {
            product: { findUnique: jest.fn() },
            productVariation: { findUnique: jest.fn() },
            bundleComponent: { findMany: jest.fn().mockResolvedValue([]) },
            cart: {
              upsert: jest.fn().mockResolvedValue({}),
              delete: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ScalesService,
          useValue: {
            resolveScaleRule: jest.fn(),
            calculateScalePrice: jest.fn(),
          },
        },
        {
          provide: CustomQuotesService,
          useValue: { assertQuoteItemPurchasable: jest.fn() },
        },
        { provide: FreeGiftsService, useValue: freeGiftsService },
        {
          provide: ProductsService,
          useValue: {
            resolveExtraDays: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  function getStoredItems(): any[] {
    const stored = redisStore[`cart:${userId}`] as { items: any[] } | undefined;
    return stored?.items ?? [];
  }

  it('1. Add a gift when the subtotal reaches the minimum.', async () => {
    redisStore[`cart:${userId}`] = {
      items: [cartItem({ quantity: 2, price: 50 })],
    };
    freeGiftsService.getActiveGift.mockResolvedValue(activeGift());

    await service.syncFreeGift(userId);

    const items = getStoredItems();
    const gift = items.find((i) => i.isFreeGift);
    expect(gift).toBeDefined();
    expect(gift.productId).toBe('cgiftprod000000000000000a');
    expect(gift.quantity).toBe(1);
    expect(gift.price).toBe(0);
    expect(gift.freeGiftId).toBe('cgift00000000000000000001');
  });

  it('2. Remove a gift when the subtotal falls below the minimum.', async () => {
    redisStore[`cart:${userId}`] = {
      items: [cartItem({ quantity: 1, price: 30 }), giftItem()],
    };
    freeGiftsService.getActiveGift.mockResolvedValue(activeGift());

    await service.syncFreeGift(userId);

    const items = getStoredItems();
    expect(items.find((i) => i.isFreeGift)).toBeUndefined();
    expect(items.length).toBe(1);
  });

  it('3. Swap a gift when the current active gift points to a different product.', async () => {
    const oldGift = giftItem({
      productId: 'cgiftprodOLD0000000000000a',
      freeGiftId: 'coldgift0000000000000000a',
      name: 'Old Gift',
    });
    redisStore[`cart:${userId}`] = {
      items: [cartItem({ quantity: 2, price: 50 }), oldGift],
    };
    freeGiftsService.getActiveGift.mockResolvedValue(activeGift());

    await service.syncFreeGift(userId);

    const items = getStoredItems();
    const gifts = items.filter((i) => i.isFreeGift);
    expect(gifts).toHaveLength(1);
    expect(gifts[0].productId).toBe('cgiftprod000000000000000a');
    expect(gifts[0].freeGiftId).toBe('cgift00000000000000000001');
  });

  it('4. Don\'t duplicate a gift if it\'s already in the cart and the subtotal has been reached.', async () => {
    redisStore[`cart:${userId}`] = {
      items: [cartItem({ quantity: 2, price: 50 }), giftItem()],
    };
    freeGiftsService.getActiveGift.mockResolvedValue(activeGift());

    await service.syncFreeGift(userId);

    const items = getStoredItems();
    const gifts = items.filter((i) => i.isFreeGift);
    expect(gifts).toHaveLength(1);
  });

  it('5. syncFreeGift Idempotent: two consecutive calls = same state.', async () => {
    redisStore[`cart:${userId}`] = {
      items: [cartItem({ quantity: 2, price: 50 })],
    };
    freeGiftsService.getActiveGift.mockResolvedValue(activeGift());

    await service.syncFreeGift(userId);
    const after1 = JSON.stringify(getStoredItems());
    await service.syncFreeGift(userId);
    const after2 = JSON.stringify(getStoredItems());
    expect(after1).toBe(after2);
  });

  it('6. removeItem throws ForbiddenException when trying to remove a gift manually.', async () => {
    redisStore[`cart:${userId}`] = { items: [giftItem()] };

    await expect(
      service.removeItem(userId, 'cgiftprod000000000000000a'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('6b. updateQuantity throws ForbiddenException ao tentar mudar qty do gift', async () => {
    redisStore[`cart:${userId}`] = {
      items: [cartItem({ quantity: 2, price: 50 }), giftItem()],
    };

    await expect(
      service.updateQuantity(userId, 'cgiftprod000000000000000a', 3),
    ).rejects.toThrow(ForbiddenException);
  });

  it('7. When there is no active gift (getActiveGift=null), remove the residual gift from the cart.', async () => {
    redisStore[`cart:${userId}`] = {
      items: [cartItem({ quantity: 2, price: 50 }), giftItem()],
    };
    freeGiftsService.getActiveGift.mockResolvedValue(null);

    await service.syncFreeGift(userId);

    const items = getStoredItems();
    expect(items.find((i) => i.isFreeGift)).toBeUndefined();
    expect(items).toHaveLength(1);
  });
});
