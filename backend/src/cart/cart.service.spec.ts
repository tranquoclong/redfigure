import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CartService } from './cart.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';
import { CustomQuotesService } from '../custom-quotes/custom-quotes.service';
import { FreeGiftsService } from '../free-gifts/free-gifts.service';
import { ProductsService } from '../products/products.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('CartService', () => {
  let service: CartService;
  let redis: RedisService;
  let prisma: PrismaService;
  let scalesService: ScalesService;
  let customQuotesService: any;

  beforeEach(async () => {
    customQuotesService = {
      assertQuoteItemPurchasable: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: RedisService,
          useValue: {
            getJson: jest.fn(),
            setJson: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            product: {
              findUnique: jest.fn(),
            },
            productVariation: {
              findUnique: jest.fn(),
            },
            bundleComponent: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            cart: {
              upsert: jest.fn().mockResolvedValue({}),
              delete: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn(),
            },

            setting: {
              findUnique: jest.fn().mockResolvedValue(null),
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
        { provide: CustomQuotesService, useValue: customQuotesService },
        {
          provide: FreeGiftsService,
          useValue: {

            getActiveGift: jest.fn().mockResolvedValue(null),
          },
        },
        {

          provide: ProductsService,
          useValue: {
            resolveExtraDays: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    redis = module.get<RedisService>(RedisService);
    prisma = module.get<PrismaService>(PrismaService);
    scalesService = module.get<ScalesService>(ScalesService);
  });

  const userId = 'user1';
  const mockProduct = {
    id: 'prod1',
    name: 'Warrior',
    basePrice: 49.9,
    isActive: true,
  };

  describe('getCart', () => {
    it('should return empty cart when nothing in Redis', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);

      const result = await service.getCart(userId);

      expect(result.items).toEqual([]);
      expect(result.subtotal).toBe(0);
    });

    it('should return cart from Redis', async () => {
      const cartData = {
        items: [
          { productId: 'prod1', quantity: 2, price: 49.9, name: 'Warrior' },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(cartData);

      const result = await service.getCart(userId);

      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe(99.8);
    });
  });

  describe('addItem', () => {
    it('should add item to empty cart and save to Redis with TTL', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        quantity: 1,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('prod1');
      expect(redis.setJson).toHaveBeenCalledWith(
        'cart:user1',
        expect.objectContaining({ items: expect.any(Array) }),
        7 * 24 * 60 * 60,
      );
    });

    it('should increase quantity if product already in cart', async () => {
      const existingCart = {
        items: [
          { productId: 'prod1', quantity: 1, price: 49.9, name: 'Warrior' },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(existingCart);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        quantity: 2,
      });

      expect(result.items[0].quantity).toBe(3);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addItem(userId, { productId: 'fake', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive product', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await expect(
        service.addItem(userId, { productId: 'prod1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      const cart = {
        items: [
          { productId: 'prod1', quantity: 2, price: 49.9, name: 'Warrior' },
          { productId: 'prod2', quantity: 1, price: 29.9, name: 'Mage' },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(cart);

      const result = await service.removeItem(userId, 'prod1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('prod2');
    });
  });

  describe('clear', () => {
    it('should delete cart from Redis', async () => {
      await service.clear(userId);

      expect(redis.del).toHaveBeenCalledWith('cart:user1');
    });
  });

  describe('addItem with variation', () => {
    it('should use variation price and name when variationId provided', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        type: 'variable',
        basePrice: 0,
      });
      (prisma.productVariation.findUnique as jest.Mock).mockResolvedValue({
        id: 'var1',
        name: 'Model A',
        price: 79,
        salePrice: null,
        image: 'https://cdn/img.webp',
      });
      (scalesService.resolveScaleRule as jest.Mock).mockResolvedValue(null);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        variationId: 'var1',
        quantity: 1,
      });

      expect(result.items[0].price).toBe(79);
      expect(result.items[0].variationName).toBe('Model A');
      expect(result.items[0].image).toBe('https://cdn/img.webp');
    });
  });

  describe('addItem with scale', () => {
    it('should apply scale percentage increase to price (scaleId = ScaleRuleItem.id)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (scalesService.resolveScaleRule as jest.Mock).mockResolvedValue({
        id: 'rs1',
        name: 'Standard Miniatures',
        items: [
          { id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 },
          { id: 'item2', name: '32mm', percentageIncrease: 15, sortOrder: 1 },
        ],
      });
      (scalesService.calculateScalePrice as jest.Mock).mockReturnValue(57.39);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        scaleId: 'item2',
        quantity: 1,
      });

      expect(result.items[0].price).toBe(57.39);
      expect(result.items[0].scaleName).toBe('32mm');
      expect(result.items[0].scaleId).toBe('item2');
      expect(scalesService.calculateScalePrice).toHaveBeenCalledWith(49.9, 15);
    });

    it('should treat same product with different scales as separate items', async () => {
      const existingCart = {
        items: [
          {
            productId: 'prod1',
            scaleId: 'item1',
            quantity: 1,
            price: 49.9,
            name: 'Warrior',
            scaleName: '28mm',
          },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(existingCart);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (scalesService.resolveScaleRule as jest.Mock).mockResolvedValue({
        id: 'rs1',
        items: [
          { id: 'item2', name: '32mm', percentageIncrease: 15, sortOrder: 1 },
        ],
      });
      (scalesService.calculateScalePrice as jest.Mock).mockReturnValue(57.39);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        scaleId: 'item2',
        quantity: 1,
      });

      expect(result.items).toHaveLength(2);
    });
  });

  describe('removeItem with composite key', () => {
    it('should remove by productId + variationId + scaleId', async () => {
      const cart = {
        items: [
          {
            productId: 'prod1',
            variationId: 'v1',
            scaleId: 's1',
            quantity: 1,
            price: 49.9,
            name: 'A',
          },
          {
            productId: 'prod1',
            variationId: 'v1',
            scaleId: 's2',
            quantity: 1,
            price: 57.39,
            name: 'A',
          },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(cart);

      const result = await service.removeItem(userId, 'prod1', 'v1', 's2');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].scaleId).toBe('s1');
    });
  });

  describe('updateQuantity with composite key', () => {
    it('should update by productId + variationId + scaleId', async () => {
      const cart = {
        items: [
          {
            productId: 'prod1',
            variationId: 'v1',
            scaleId: 's1',
            quantity: 1,
            price: 49.9,
            name: 'A',
          },
          {
            productId: 'prod1',
            variationId: 'v1',
            scaleId: 's2',
            quantity: 1,
            price: 57.39,
            name: 'A',
          },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(cart);

      const result = await service.updateQuantity(
        userId,
        'prod1',
        5,
        'v1',
        's2',
      );

      expect(result.items[1].quantity).toBe(5);
      expect(result.items[0].quantity).toBe(1);
    });
  });

  describe('out of stock validation', () => {
    it('should reject product with zero stock', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        manageStock: true,
        stock: 0,
        reservedStock: 0,
        isDraft: false,
      });

      await expect(
        service.addItem(userId, { productId: 'prod1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject product with all stock reserved', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        manageStock: true,
        stock: 5,
        reservedStock: 5,
        isDraft: false,
      });

      await expect(
        service.addItem(userId, { productId: 'prod1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow product with manageStock=false regardless of stock', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        manageStock: false,
        stock: 0,
        isDraft: false,
        images: [],
        variations: [],
        attributes: [],
      });
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (redis.setJson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        quantity: 1,
      });
      expect(result.items).toHaveLength(1);
    });

    it('should reject draft product', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        isDraft: true,
        isActive: true,
      });

      await expect(
        service.addItem(userId, { productId: 'prod1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bundle cart items', () => {
    const bundleProduct = {
      id: 'bundle-1',
      name: 'Kit Peregrinos',
      basePrice: 0,
      salePrice: null,
      isActive: true,
      type: 'bundle',
      bundleDiscount: 10,
      images: [{ mediaFile: { thumb: 'bundle-thumb.jpg' } }],
      variations: [],
      attributes: [],
    };

    const childA = {
      id: 'child-a',
      name: 'Peregrino A',
      slug: 'peregrino-a',
      basePrice: 50,
      salePrice: 40,
      images: [{ mediaFile: { thumb: 'child-a-thumb.jpg' } }],
    };
    const childB = {
      id: 'child-b',
      name: 'Peregrino B',
      slug: 'peregrino-b',
      basePrice: 30,
      salePrice: null,
      images: [],
    };

    it('should add bundle with embedded bundleChildren', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(bundleProduct);
      (prisma as any).bundleComponent.findMany.mockResolvedValue([
        {
          childProduct: childA,
          childVariation: null,
          childProductId: 'child-a',
          childVariationId: null,
          quantity: 2,
        },
        {
          childProduct: childB,
          childVariation: null,
          childProductId: 'child-b',
          childVariationId: null,
          quantity: 1,
        },
      ]);
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (redis.setJson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.addItem(userId, {
        productId: 'bundle-1',
        quantity: 1,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Kit Peregrinos');

      expect(result.items[0].price).toBe(99);
      expect(result.items[0].bundleChildren).toHaveLength(2);
      expect(result.items[0].bundleChildren![0]).toMatchObject({
        productId: 'child-a',
        name: 'Peregrino A',
        quantity: 2,
        unitPrice: 40,
        discountedPrice: 36,
      });
      expect(result.items[0].bundleDiscount).toBe(10);
    });

    it('should merge quantity when same bundle added again', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(bundleProduct);
      (prisma as any).bundleComponent.findMany.mockResolvedValue([
        {
          childProduct: childA,
          childVariation: null,
          childProductId: 'child-a',
          childVariationId: null,
          quantity: 1,
        },
      ]);

      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            productId: 'bundle-1',
            quantity: 1,
            price: 36,
            name: 'Kit Peregrinos',
            bundleChildren: [],
            bundleDiscount: 10,
          },
        ],
      });
      (redis.setJson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.addItem(userId, {
        productId: 'bundle-1',
        quantity: 2,
      });

      expect(result.items[0].quantity).toBe(3);
    });

    it('should calculate subtotal using bundle price', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(bundleProduct);
      (prisma as any).bundleComponent.findMany.mockResolvedValue([
        {
          childProduct: childA,
          childVariation: null,
          childProductId: 'child-a',
          childVariationId: null,
          quantity: 1,
        },
      ]);
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (redis.setJson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.addItem(userId, {
        productId: 'bundle-1',
        quantity: 2,
      });

      expect(result.subtotal).toBe(72);
    });

    it('should apply scale to bundle price', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(bundleProduct);
      (prisma as any).bundleComponent.findMany.mockResolvedValue([
        {
          childProduct: childA,
          childVariation: null,
          childProductId: 'child-a',
          childVariationId: null,
          quantity: 1,
        },
      ]);
      (scalesService.resolveScaleRule as jest.Mock).mockResolvedValue({
        items: [{ id: 'scale-75', name: '75mm', percentageIncrease: 50 }],
      });
      (scalesService.calculateScalePrice as jest.Mock).mockReturnValue(54);
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (redis.setJson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.addItem(userId, {
        productId: 'bundle-1',
        scaleId: 'scale-75',
        quantity: 1,
      });

      expect(result.items[0].price).toBe(54);
      expect(result.items[0].scaleName).toBe('75mm');
      expect(result.items[0].scalePercentage).toBe(50);
    });
  });

  describe('addQuoteItem — customized quote', () => {
    const quoteItem = {
      id: 'qi1',
      name: 'Custom Piece',
      description: 'details',
      unitPrice: 250,
      maxQuantity: 2,
      status: 'QUOTED',
      weight: 0.5,
      width: 11,
      height: 16,
      length: 5,
      quote: {
        id: 'q1',
        token: 'tok123',
        status: 'SENT',
        expiresAt: new Date(Date.now() + 86_400_000),
        customerEmail: 'client@example.com',
        userId: null,
      },
    };

    it('should add quote item to cart with price + name from DB', async () => {
      customQuotesService.assertQuoteItemPurchasable.mockResolvedValue(
        quoteItem,
      );
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (redis.setJson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.addQuoteItem(
        userId,
        'client@example.com',
        'qi1',
        1,
      );

      expect(
        customQuotesService.assertQuoteItemPurchasable,
      ).toHaveBeenCalledWith('qi1', 'client@example.com');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        quoteItemId: 'qi1',
        quoteToken: 'tok123',
        quantity: 1,
        price: 250,
        name: 'Custom Piece',
      });
      expect(result.items[0].productId).toBeUndefined();
    });

    it('should merge quantity if quote item already in cart', async () => {
      customQuotesService.assertQuoteItemPurchasable.mockResolvedValue(
        quoteItem,
      );
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            quoteItemId: 'qi1',
            quantity: 1,
            price: 250,
            name: 'Custom Piece',
          },
        ],
      });
      (redis.setJson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.addQuoteItem(
        userId,
        'client@example.com',
        'qi1',
        1,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(2);
    });

    it('should reject when merged quantity exceeds maxQuantity', async () => {
      customQuotesService.assertQuoteItemPurchasable.mockResolvedValue({
        ...quoteItem,
        maxQuantity: 1,
      });
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [{ quoteItemId: 'qi1', quantity: 1, price: 250, name: 'x' }],
      });

      await expect(
        service.addQuoteItem(userId, 'client@example.com', 'qi1', 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate ForbiddenException from customQuotesService (ownership)', async () => {
      customQuotesService.assertQuoteItemPurchasable.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.addQuoteItem(userId, 'outro@example.com', 'qi1', 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate NotFoundException when quoteItem does not exist', async () => {
      customQuotesService.assertQuoteItemPurchasable.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.addQuoteItem(userId, 'client@example.com', 'bad-id', 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCartRevalidated', () => {
    it('empty cart returns {items:[], subtotal:0}', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);

      const result = await service.getCartRevalidated(userId);

      expect(result).toEqual({ items: [], subtotal: 0 });
    });

    it('item with ok stock and snapshot=current price → outOfStock false, priceChanged false', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            productId: 'prod1',
            quantity: 2,
            price: 49.9,
            name: 'Warrior',
          },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        type: 'simple',
        manageStock: true,
        stock: 10,
        reservedStock: 2,
        basePrice: 49.9,
        salePrice: null,
        isActive: true,
        isDraft: false,
      });

      const result = await service.getCartRevalidated(userId);

      expect(result.items[0]).toMatchObject({
        productId: 'prod1',
        availableStock: 8,
        outOfStock: false,
        currentPrice: 49.9,
        priceChanged: false,
        priceChangedDelta: 0,
      });
    });

    it('item with zero stock from another sale → outOfStock true', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            productId: 'prod1',
            quantity: 3,
            price: 49.9,
            name: 'Warrior',
          },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        type: 'simple',
        manageStock: true,
        stock: 5,
        reservedStock: 5,
        basePrice: 49.9,
        salePrice: null,
        isActive: true,
        isDraft: false,
      });

      const result = await service.getCartRevalidated(userId);

      expect(result.items[0]).toMatchObject({
        availableStock: 0,
        outOfStock: true,
      });
    });

    it('quantity > availableStock → outOfStock true (partial does not serve checkout)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            productId: 'prod1',
            quantity: 5,
            price: 49.9,
            name: 'Warrior',
          },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        type: 'simple',
        manageStock: true,
        stock: 10,
        reservedStock: 8,
        basePrice: 49.9,
        salePrice: null,
        isActive: true,
        isDraft: false,
      });

      const result = await service.getCartRevalidated(userId);

      expect(result.items[0]).toMatchObject({
        availableStock: 2,
        outOfStock: true,
      });
    });

    it('Admin lowered the price after add-to-cart → priceChanged true, delta negative', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            productId: 'prod1',
            quantity: 1,
            price: 49.9,
            name: 'Warrior',
          },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        type: 'simple',
        manageStock: true,
        stock: 10,
        reservedStock: 0,
        basePrice: 49.9,
        salePrice: 39.9,
        isActive: true,
        isDraft: false,
      });

      const result = await service.getCartRevalidated(userId);

      expect(result.items[0]).toMatchObject({
        currentPrice: 39.9,
        priceChanged: true,
        priceChangedDelta: -10,
      });
    });

    it('product isActive=false → outOfStock true (not sellable)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            productId: 'prod1',
            quantity: 1,
            price: 49.9,
            name: 'Warrior',
          },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        type: 'simple',
        manageStock: true,
        stock: 10,
        reservedStock: 0,
        basePrice: 49.9,
        salePrice: null,
        isActive: false,
        isDraft: false,
      });

      const result = await service.getCartRevalidated(userId);

      expect(result.items[0].outOfStock).toBe(true);
    });

    it('Product deleted (findUnique=null) → outOfStock true', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          { productId: 'gone', quantity: 1, price: 30, name: 'Removed' },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getCartRevalidated(userId);

      expect(result.items[0].outOfStock).toBe(true);
      expect(result.items[0].availableStock).toBe(0);
    });

    it('variation: uses variation stock/price, not parent', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            productId: 'prod1',
            variationId: 'var1',
            quantity: 1,
            price: 60,
            name: 'Warrior - Red',
          },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        type: 'variable',
        manageStock: false,
        isActive: true,
        isDraft: false,
      });
      (prisma.productVariation.findUnique as jest.Mock).mockResolvedValue({
        id: 'var1',
        productId: 'prod1',
        manageStock: true,
        stock: 3,
        reservedStock: 0,
        price: 60,
        salePrice: 55,
        deletedAt: null,
      });

      const result = await service.getCartRevalidated(userId);

      expect(result.items[0]).toMatchObject({
        availableStock: 3,
        outOfStock: false,
        currentPrice: 55,
        priceChanged: true,
        priceChangedDelta: -5,
      });
    });

    it('bundle item skips individual stock check (managed per child)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            productId: 'bundle1',
            quantity: 1,
            price: 100,
            name: 'Kit Heroes',
            bundleDiscount: 10,
          },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'bundle1',
        type: 'bundle',
        manageStock: false,
        isActive: true,
        isDraft: false,
        basePrice: 100,
        salePrice: null,
      });

      const result = await service.getCartRevalidated(userId);

      expect(result.items[0]).toMatchObject({
        outOfStock: false,
        availableStock: null,
      });
    });

    it('quoteItemId: skips stock check (real validation is at checkout via assertQuoteItemPurchasable)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            quoteItemId: 'qi1',
            quantity: 1,
            price: 200,
            name: 'Custom Quote Item',
          },
        ],
      });

      const result = await service.getCartRevalidated(userId);

      expect(prisma.product.findUnique).not.toHaveBeenCalled();
      expect(result.items[0].outOfStock).toBe(false);
    });

    it('subtotal uses currentPrice when priceChanged (not stale snapshot)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          {
            productId: 'prod1',
            quantity: 2,
            price: 50,
            name: 'X',
          },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        type: 'simple',
        manageStock: true,
        stock: 10,
        reservedStock: 0,
        basePrice: 50,
        salePrice: 40,
        isActive: true,
        isDraft: false,
      });

      const result = await service.getCartRevalidated(userId);

      expect(result.subtotal).toBe(80);
    });
  });

  describe('Database Persistence (shadow write)', () => {
    beforeEach(() => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        manageStock: true,
        stock: 10,
        reservedStock: 0,
        isDraft: false,
      });
    });

    it('Logged user: addItem fires upsert in prisma.cart', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      const upsertSpy = (prisma as any).cart.upsert as jest.Mock;

      await service.addItem(userId, { productId: 'prod1', quantity: 1 });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          create: expect.objectContaining({ userId }),
          update: expect.objectContaining({ reminderSentAt: null }),
        }),
      );
    });

    it('anonymous user: Does NOT touch DB (sessionId does not map to User)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      const upsertSpy = (prisma as any).cart.upsert as jest.Mock;

      await service.addItem('anon:550e8400-e29b-41d4-a716-446655440000', {
        productId: 'prod1',
        quantity: 1,
      });

      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it('DB failure does not propagate (Redis already saved — best-effort)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      const upsertSpy = (prisma as any).cart.upsert as jest.Mock;
      upsertSpy.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.addItem(userId, { productId: 'prod1', quantity: 1 }),
      ).resolves.toBeDefined();
    });

    it('clear: Deletes the cart in the DB for a logged user.', async () => {
      const deleteSpy = (prisma as any).cart.delete as jest.Mock;

      await service.clear(userId);

      expect(deleteSpy).toHaveBeenCalledWith({ where: { userId } });
    });

    it('clear: P2025 (cart did not exist) is swallowed (idempotent)', async () => {
      const deleteSpy = (prisma as any).cart.delete as jest.Mock;
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });

      Object.setPrototypeOf(
        p2025,
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      deleteSpy.mockRejectedValue(p2025);

      await expect(service.clear(userId)).resolves.toBeUndefined();
    });

    it('Clear: anon user does not touch the DB.', async () => {
      const deleteSpy = (prisma as any).cart.delete as jest.Mock;

      await service.clear('anon:550e8400-e29b-41d4-a716-446655440000');

      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('getPersistedCartForUser', () => {
    it('Returns items + updatedAt + reminderSentAt from DB.', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      const updatedAt = new Date('2026-04-30T10:00:00Z');
      findUniqueSpy.mockResolvedValue({
        id: 'cart1',
        userId,
        items: [{ productId: 'p1', quantity: 2, price: 10, name: 'X' }],
        updatedAt,
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);

      expect(result).toEqual({
        items: [{ productId: 'p1', quantity: 2, price: 10, name: 'X' }],
        updatedAt,
        reminderSentAt: null,
      });
    });

    it('Returns null when the user does not have a persisted cart.', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      findUniqueSpy.mockResolvedValue(null);

      const result = await service.getPersistedCartForUser(userId);

      expect(result).toBeNull();
    });

    it('TypeGuard exhaustive: drops malformed items + logs warn (anti-DB-drift)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      const warnSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [

          { productId: 'p1', quantity: 1, price: 50, name: 'OK' },

          {
            quoteItemId: 'q1',
            quantity: 1,
            price: 100,
            name: 'Quote OK',
          },

          { quantity: 1, price: 50, name: 'sem id' },

          {
            productId: 'p2',
            quantity: 1,
            price: 50,
            name: 'bundle ruim',
            bundleChildren: 'corrupted',
          },

          {
            productId: 'p3',
            quantity: 1,
            price: 50,
            name: 'X',
            image: 42,
          },

          { productId: 'p4', quantity: '2', price: 50, name: 'qty str' },

          null,

          [],
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);

      expect(result?.items).toHaveLength(2);
      expect(result?.items[0].name).toBe('OK');
      expect(result?.items[1].name).toBe('Quote OK');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('dropped 6 corrupted item(s)'),
      );
      warnSpy.mockRestore();
    });

    it('Rejects NaN, Infinity and negative quantity/price', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [
          { productId: 'p1', quantity: NaN, price: 50, name: 'NaN qty' },
          {
            productId: 'p2',
            quantity: Infinity,
            price: 50,
            name: 'inf qty',
          },
          { productId: 'p3', quantity: -1, price: 50, name: 'neg qty' },
          { productId: 'p4', quantity: 1, price: -100, name: 'neg price' },
          {
            productId: 'p5',
            quantity: 1,
            price: NaN,
            name: 'NaN price',
          },

          {
            productId: 'p6',
            quantity: 99999,
            price: 50,
            name: 'qty huge',
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);

      expect(result?.items).toHaveLength(0);
    });

    it('Rejects image with javascript: / data: URI (anti-XSS)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [

          {
            productId: 'p1',
            quantity: 1,
            price: 50,
            name: 'XSS attempt',
            image: 'javascript:alert(1)',
          },

          {
            productId: 'p2',
            quantity: 1,
            price: 50,
            name: 'data uri',
            image: 'data:text/html,<script>alert(1)</script>',
          },

          {
            productId: 'p3',
            quantity: 1,
            price: 50,
            name: 'OK https',
            image: 'https://cdn.redfigure.com/x.jpg',
          },

          {
            productId: 'p4',
            quantity: 1,
            price: 50,
            name: 'OK relative',
            image: '/uploads/y.png',
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);

      expect(result?.items).toHaveLength(2);
      expect(result?.items.map((i) => i.name).sort()).toEqual([
        'OK https',
        'OK relative',
      ]);
    });

    it('Explicit reconstruction: strip extra fields (anti-prototype-pollution)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [
          {
            productId: 'p1',
            quantity: 1,
            price: 50,
            name: 'OK',

            isAdmin: true,

            __proto__: { polluted: true },

            secretFlag: 'attacker-controlled',
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);

      expect(result?.items).toHaveLength(1);
      const item = result!.items[0] as Record<string, unknown>;
      expect(item.isAdmin).toBeUndefined();
      expect(item.secretFlag).toBeUndefined();

      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('Rejects name > 255 chars (anti-DoS for payload bloat)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [
          {
            productId: 'p1',
            quantity: 1,
            price: 50,
            name: 'x'.repeat(256),
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);
      expect(result?.items).toHaveLength(0);
    });

    it('bundleChildren sanitizes recursively (anti-negative-price + prototype pollution)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [
          {
            productId: 'bundle1',
            quantity: 1,
            price: 100,
            name: 'Kit',
            bundleChildren: [

              {
                productId: 'c1',
                quantity: 1,
                unitPrice: 60,
                discountedPrice: 50,
                name: 'OK',
              },

              {
                productId: 'c2',
                quantity: 1,
                unitPrice: -1000,
                discountedPrice: -800,
                name: 'Negative',
              },

              {
                productId: 'c3',
                quantity: 1,
                unitPrice: 30,
                discountedPrice: 25,
                name: 'OK 2',
                __proto__: { polluted: true },
                isAdmin: true,
              },

              {
                productId: 'c4',
                quantity: NaN,
                unitPrice: 30,
                discountedPrice: 25,
                name: 'NaN',
              },

              {
                productId: 'c5',
                quantity: 1,
                unitPrice: 30,
                discountedPrice: 25,
                name: 'XSS img',
                image: 'javascript:alert(1)',
              },
            ],
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);
      expect(result?.items).toHaveLength(1);
      const children = result!.items[0].bundleChildren;
      expect(children).toHaveLength(2);
      const c3 = children!.find((c) => c.productId === 'c3') as Record<
        string,
        unknown
      >;
      expect(c3.isAdmin).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('Financial modifiers outside of [0,100] are stripped (anti-price-zero).', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [
          {
            productId: 'p1',
            quantity: 1,
            price: 100,
            name: 'X',
            bundleDiscount: 999999,
            scalePercentage: -50,
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);
      expect(result?.items).toHaveLength(1);

      expect(result!.items[0].bundleDiscount).toBeUndefined();
      expect(result!.items[0].scalePercentage).toBeUndefined();
    });

    it('quantity=0 drops item (no semantics + bug in tax/shipping)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [{ productId: 'p1', quantity: 0, price: 50, name: 'zero qty' }],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);
      expect(result?.items).toHaveLength(0);
    });

    it('rejects protocol-relative image)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [
          {
            productId: 'p1',
            quantity: 1,
            price: 50,
            name: 'X',
            image: '//example.com/bad.png',
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);
      expect(result?.items).toHaveLength(0);
    });

    it('rejects float quantity (should be integer)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [
          {
            productId: 'p1',
            quantity: 1.5,
            price: 50,
            name: 'X',
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);
      expect(result?.items).toHaveLength(0);
    });

    it('rejects strings with < or > (anti-xss defense in depth)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [

          {
            productId: 'p1',
            quantity: 1,
            price: 50,
            name: '<script>alert(1)</script>',
          },

          {
            productId: 'p2',
            quantity: 1,
            price: 50,
            name: 'Valido',
            variationLabel: '<img src=x>',
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);

      expect(result?.items).toHaveLength(1);
      expect(result!.items[0].name).toBe('Valido');
      expect(result!.items[0].variationLabel).toBeUndefined();
    });

    it('optional strings > limit fall back to undefined (anti payload bloat)', async () => {
      const findUniqueSpy = (prisma as any).cart.findUnique as jest.Mock;
      jest.spyOn(service['logger'], 'warn').mockImplementation();
      findUniqueSpy.mockResolvedValue({
        userId,
        items: [
          {
            productId: 'p1',
            quantity: 1,
            price: 50,
            name: 'OK',
            customItemDescription: 'A'.repeat(1001),
            variationLabel: 'B'.repeat(256),
          },
        ],
        updatedAt: new Date(),
        reminderSentAt: null,
      });

      const result = await service.getPersistedCartForUser(userId);
      expect(result?.items).toHaveLength(1);
      expect(result!.items[0].customItemDescription).toBeUndefined();
      expect(result!.items[0].variationLabel).toBeUndefined();
    });
  });

  describe('cleanOutOfStock', () => {
    it('remove out-of-stock items and keeps the rest', async () => {
      const cartData = {
        items: [
          { productId: 'ok', quantity: 1, price: 50, name: 'Has Stock' },
          { productId: 'gone', quantity: 1, price: 30, name: 'Out of Stock' },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(cartData);
      (prisma.product.findUnique as jest.Mock).mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === 'ok') {
            return Promise.resolve({
              id: 'ok',
              type: 'simple',
              manageStock: true,
              stock: 5,
              reservedStock: 0,
              basePrice: 50,
              salePrice: null,
              isActive: true,
              isDraft: false,
            });
          }
          return Promise.resolve(null);
        },
      );

      const result = await service.cleanOutOfStock(userId);

      expect(result.removedCount).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('ok');
      expect(redis.setJson).toHaveBeenCalled();
    });

    it('nothing to remove → no-op (dont write Redis if not changed)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        items: [
          { productId: 'ok', quantity: 1, price: 50, name: 'Has Stock' },
        ],
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'ok',
        type: 'simple',
        manageStock: true,
        stock: 5,
        reservedStock: 0,
        basePrice: 50,
        salePrice: null,
        isActive: true,
        isDraft: false,
      });

      const result = await service.cleanOutOfStock(userId);

      expect(result.removedCount).toBe(0);
      expect(result.items).toHaveLength(1);
      expect(redis.setJson).not.toHaveBeenCalled();
    });
  });
});
