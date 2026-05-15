import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentsService } from '../payments/payments.service';
import { CategoriesService } from '../categories/categories.service';
import { ShippingService } from '../shipping/shipping.service';
import { CustomQuotesService } from '../custom-quotes/custom-quotes.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: any;
  let scalesService: any;
  let couponsService: any;
  let paymentsService: any;
  let mockCategoriesService: any;
  let mockShippingService: any;
  let mockCustomQuotesService: any;

  const mockProduct = {
    id: 'prod1',
    name: 'Elven Warrior',
    basePrice: 49.9,
    salePrice: null,
    isActive: true,
    type: 'variable',
    tags: [{ id: 'tag1' }],
    variations: [
      { id: 'var1', name: 'Model A', price: 49.9, salePrice: null },
      { id: 'var2', name: 'Model B', price: 79, salePrice: 69 },
    ],
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      productCategory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      bundleComponent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    scalesService = {
      resolveScaleRule: jest.fn(),
      calculateScalePrice: jest.fn(),
    };
    couponsService = {
      validate: jest.fn(),
    };
    paymentsService = {
      calculateMethodDiscount: jest.fn(),
    };
    mockCategoriesService = {
      getDescendantIds: jest.fn().mockResolvedValue([]),
    };
    mockShippingService = {

      validateFreeShipping: jest.fn().mockResolvedValue(undefined),

      validateShippingPrice: jest
        .fn()
        .mockImplementation((_items, _zip, _svc, expected) =>
          Promise.resolve({ verifiedAmount: expected }),
        ),
    };
    mockCustomQuotesService = {
      assertQuoteItemPurchasable: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ScalesService, useValue: scalesService },
        { provide: CouponsService, useValue: couponsService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: CategoriesService, useValue: mockCategoriesService },
        { provide: ShippingService, useValue: mockShippingService },
        { provide: CustomQuotesService, useValue: mockCustomQuotesService },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe('base price', () => {
    it('should use product.basePrice for simple product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].basePrice).toBe(100);
      expect(result.items[0].unitPrice).toBe(100);
      expect(result.subtotal).toBe(100);
    });

    it('should use product.salePrice when it exists', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        salePrice: 80,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].basePrice).toBe(80);
    });

    it('should use variation.price when variationId is provided', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var1', quantity: 2 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].basePrice).toBe(49.9);
      expect(result.items[0].lineTotal).toBe(99.8);
    });

    it('should use variation.salePrice over variation.price', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var2', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].basePrice).toBe(69);
    });

    it('should throw error on inactive product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error on non-existent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'nonexistent', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error on non-existent variation', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [
            { productId: 'prod1', variationId: 'nonexistent', quantity: 1 },
          ],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('scale', () => {
    it('should apply percentageIncrease when scaleId is provided', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [
          { id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 },
          { id: 'item2', name: '75mm', percentageIncrease: 150, sortOrder: 1 },
        ],
      });
      scalesService.calculateScalePrice.mockReturnValue(124.75);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          {
            productId: 'prod1',
            variationId: 'var1',
            scaleId: 'item2',
            quantity: 1,
          },
        ],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].scalePercentage).toBe(150);
      expect(result.items[0].unitPrice).toBe(124.75);
      expect(scalesService.calculateScalePrice).toHaveBeenCalledWith(49.9, 150);
    });

    it('should use base scale (0%) without changing price', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [
          { id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 },
        ],
      });
      scalesService.calculateScalePrice.mockReturnValue(49.9);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          {
            productId: 'prod1',
            variationId: 'var1',
            scaleId: 'item1',
            quantity: 1,
          },
        ],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].scalePercentage).toBe(0);
      expect(result.items[0].unitPrice).toBe(49.9);
    });

    it('should ignore scale when product has noScales (resolveScaleRule returns null)', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue(null);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          {
            productId: 'prod1',
            variationId: 'var1',
            scaleId: 'item1',
            quantity: 1,
          },
        ],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].scalePercentage).toBe(0);
      expect(result.items[0].unitPrice).toBe(49.9);
    });

    it('should throw error when scaleId does not exist in the product rule', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [
          { id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 },
        ],
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [
            {
              productId: 'prod1',
              variationId: 'var1',
              scaleId: 'nonexistent',
              quantity: 1,
            },
          ],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not apply scale when scaleId is omitted', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].scalePercentage).toBe(0);
      expect(scalesService.resolveScaleRule).not.toHaveBeenCalled();
    });
  });

  describe('coupon', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);
    });

    it('should apply PERCENTAGE discount on subtotal', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 10,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['DISCOUNT10'],
        shippingAmount: 15,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.couponDiscount).toBe(10);
      expect(result.total).toBe(105);
    });

    it('should apply FIXED discount limited to subtotal', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 100,
        value: 100,
        type: 'FIXED',
        couponId: 'c2',
        categoryId: null,
        tagId: null,
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['FIXED100'],
        shippingAmount: 15,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.couponDiscount).toBe(100);
      expect(result.total).toBe(15);
    });

    it('should apply FREE_SHIPPING zeroing shipping', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 0,
        value: 0,
        type: 'FREE_SHIPPING',
        couponId: 'c3',
        categoryId: null,
        tagId: null,
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['FREESHIPPING'],
        shippingAmount: 25,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.isFreeShipping).toBe(true);
      expect(result.shipping).toBe(0);
      expect(result.total).toBe(100);
    });

    it('should reject coupon when no item belongs to the restricted category', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        tags: [],
      });
      couponsService.validate.mockResolvedValue({
        discount: 10,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c4',
        categoryId: 'cat-restricted',
        tagId: null,
      });
      mockCategoriesService.getDescendantIds.mockResolvedValue([]);

      prisma.productCategory.findMany.mockResolvedValue([
        { categoryId: 'cat-other' },
      ]);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          couponCodes: ['CATDESC'],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject coupon when no item has the restricted tag', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        tags: [{ id: 'tag-other' }],
      });
      couponsService.validate.mockResolvedValue({
        discount: 10,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c5',
        categoryId: null,
        tagId: 'tag-restricted',
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          couponCodes: ['TAGDESC'],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not apply coupon when couponCode is not provided', async () => {
      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 10,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.couponDiscount).toBe(0);
      expect(result.appliedCoupons[0]?.couponId).toBeUndefined();
      expect(couponsService.validate).not.toHaveBeenCalled();
    });
  });

  describe('payment discount', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 200,
      });
    });

    it('should calculate 0% for credit_card', async () => {
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 15,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
        paymentMethod: 'credit_card',
      });

      expect(result.paymentDiscount).toBe(0);
    });
  });

  describe('quote items (custom quote)', () => {
    const quoteItem = {
      id: 'qi1',
      status: 'QUOTED',
      unitPrice: 250,
      maxQuantity: 2,
      name: 'Custom Hulk Miniature',
      description: 'Detailed 75mm scale',
      weight: 0.5,
      width: 12,
      height: 18,
      length: 8,
      quote: {
        id: 'q1',
        status: 'SENT',
        expiresAt: new Date(Date.now() + 86_400_000),
        customerEmail: 'client@example.com',
        userId: null,
      },
    };

    it('should calculate price from DB, ignoring any value from the frontend', async () => {
      mockCustomQuotesService.assertQuoteItemPurchasable.mockResolvedValue(
        quoteItem,
      );
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        userEmail: 'client@example.com',
        items: [{ quoteItemId: 'qi1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].unitPrice).toBe(250);
      expect(result.items[0].lineTotal).toBe(250);
      expect(result.items[0].quoteItemId).toBe('qi1');
      expect(result.items[0].productId).toBeUndefined();
      expect(result.items[0].scalePercentage).toBe(0);
      expect(result.subtotal).toBe(250);
    });

    it('should propagate weight/dims to shipping via customWeight/customWidth/...', async () => {
      mockCustomQuotesService.assertQuoteItemPurchasable.mockResolvedValue(
        quoteItem,
      );
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        userEmail: 'client@example.com',
        items: [{ quoteItemId: 'qi1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].customWeight).toBe(0.5);
      expect(result.items[0].customWidth).toBe(12);
      expect(result.items[0].customHeight).toBe(18);
      expect(result.items[0].customLength).toBe(8);
    });

    it('should reject when userEmail is not sent (ownership check)', async () => {
      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ quoteItemId: 'qi1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when quantity exceeds maxQuantity', async () => {
      mockCustomQuotesService.assertQuoteItemPurchasable.mockResolvedValue({
        ...quoteItem,
        maxQuantity: 1,
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          userEmail: 'client@example.com',
          items: [{ quoteItemId: 'qi1', quantity: 5 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException when quoteItem does not exist', async () => {
      mockCustomQuotesService.assertQuoteItemPurchasable.mockRejectedValue(
        new NotFoundException('Quote item not found'),
      );

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          userEmail: 'client@example.com',
          items: [{ quoteItemId: 'missing', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequest when quote expired', async () => {
      mockCustomQuotesService.assertQuoteItemPurchasable.mockRejectedValue(
        new BadRequestException('Quote expired'),
      );

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          userEmail: 'client@example.com',
          items: [{ quoteItemId: 'qi1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate Forbidden when user email does not match owner', async () => {
      mockCustomQuotesService.assertQuoteItemPurchasable.mockRejectedValue(
        new ForbiddenException('This quote belongs to another client'),
      );

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          userEmail: 'outro@example.com',
          items: [{ quoteItemId: 'qi1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when invalid item (without productId or quoteItemId)', async () => {
      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('combinations — COMPLETE CHECKOUT', () => {

    it('multi-coupon: FIXED + PERCENTAGE in order (subtotal 200, 50 fixed + 10% over the rest = 150 total)', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 200000,
        salePrice: null,
      });

      couponsService.validate
        .mockResolvedValueOnce({
          discount: 50000,
          value: 50000,
          type: 'FIXED',
          couponId: 'cFix',
          categoryId: null,
          tagId: null,
        })
        .mockResolvedValueOnce({
          discount: 20,
          value: 10,
          type: 'PERCENTAGE',
          couponId: 'cPct',
          categoryId: null,
          tagId: null,
        });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['FIXED50', 'PCT10'],
        shippingAmount: 10,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.subtotal).toBe(200);
      expect(result.couponDiscount).toBe(65);
      expect(result.appliedCoupons).toHaveLength(2);

      const fixedApplied = result.appliedCoupons.find(
        (c) => c.type === 'FIXED',
      );
      expect(fixedApplied?.discount).toBe(50);

      const pctApplied = result.appliedCoupons.find(
        (c) => c.type === 'PERCENTAGE',
      );
      expect(pctApplied?.discount).toBe(15);

      expect(result.total).toBe(145);
    });

    it('multi-coupon: reverse input order does not change result (PERCENTAGE+FIXED give same total)', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 200,
        salePrice: null,
      });

      couponsService.validate
        .mockResolvedValueOnce({
          discount: 20,
          value: 10,
          type: 'PERCENTAGE',
          couponId: 'cPct',
          categoryId: null,
          tagId: null,
        })
        .mockResolvedValueOnce({
          discount: 50,
          value: 50,
          type: 'FIXED',
          couponId: 'cFix',
          categoryId: null,
          tagId: null,
        });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['PCT10', 'FIXED50'],
        shippingAmount: 10,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.couponDiscount).toBe(65);
      expect(result.total).toBe(145);
    });

    it('multi-coupon: FIXED + PERCENTAGE + FREE_SHIPPING combined', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 200,
        salePrice: null,
      });
      couponsService.validate
        .mockResolvedValueOnce({
          discount: 30,
          value: 30,
          type: 'FIXED',
          couponId: 'cFix',
          categoryId: null,
          tagId: null,
        })
        .mockResolvedValueOnce({
          discount: 20,
          value: 10,
          type: 'PERCENTAGE',
          couponId: 'cPct',
          categoryId: null,
          tagId: null,
        })
        .mockResolvedValueOnce({
          discount: 0,
          value: 0,
          type: 'FREE_SHIPPING',
          couponId: 'cShip',
          categoryId: null,
          tagId: null,
          isFreeShipping: true,
        });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);
      mockShippingService.validateFreeShipping.mockResolvedValue(undefined);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['FIXED30', 'PCT10', 'SHIPPING'],
        shippingAmount: 25,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.subtotal).toBe(200);
      expect(result.couponDiscount).toBe(47);
      expect(result.shipping).toBe(0);
      expect(result.isFreeShipping).toBe(true);

      expect(result.total).toBe(153);
    });

    it('cap MAX_STACKED_COUPONS=3: rejects when CouponsService throw on 4th coupon', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        salePrice: null,
      });

      const validResp = (id: string) => ({
        discount: 0,
        value: 0,
        type: 'FREE_SHIPPING',
        couponId: id,
        categoryId: null,
        tagId: null,
        isFreeShipping: true,
      });
      couponsService.validate
        .mockResolvedValueOnce(validResp('a'))
        .mockResolvedValueOnce(validResp('b'))
        .mockResolvedValueOnce(validResp('c'))
        .mockRejectedValueOnce(
          new BadRequestException('Maximum of 3 coupons per order'),
        );
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          couponCodes: ['A', 'B', 'C', 'D'],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(/maximum of 3/i);
    });

    it('automatic free shipping by tier: combines coupon % + quote ME + validates tier', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 200,
        salePrice: null,
      });
      couponsService.validate.mockResolvedValueOnce({
        discount: 20,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'cPct',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      mockShippingService.validateFreeShipping.mockResolvedValue(undefined);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['PCT10'],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.subtotal).toBe(200);
      expect(result.couponDiscount).toBe(20);
      expect(result.shipping).toBe(0);
      expect(result.isFreeShipping).toBe(false);
      expect(result.total).toBe(180);

      expect(mockShippingService.validateFreeShipping).toHaveBeenCalledTimes(1);
      expect(mockShippingService.validateFreeShipping).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ productId: 'prod1', quantity: 1 }),
        ]),
        '01001000',
        200,
        undefined,
      );
    });

    it('eligibleSubtotal cap: PERCENTAGE 50% restricted to cat X with mixed items DOES NOT apply to items outside (Gemini R1 #1)', async () => {

      prisma.product.findUnique
        .mockResolvedValueOnce({
          ...mockProduct,
          id: 'cheap-x',
          type: 'simple',
          basePrice: 5,
          salePrice: null,
        })
        .mockResolvedValueOnce({
          ...mockProduct,
          id: 'expensive-other',
          type: 'simple',
          basePrice: 1000,
          salePrice: null,
        });

      prisma.productCategory.findMany.mockResolvedValueOnce([
        { productId: 'cheap-x' },
      ]);
      mockCategoriesService.getDescendantIds.mockResolvedValue([]);
      couponsService.validate.mockResolvedValue({
        discount: 502.5,
        value: 50,
        type: 'PERCENTAGE',
        couponId: 'cCatX',
        categoryId: 'cat-x',
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          { productId: 'cheap-x', quantity: 1 },
          { productId: 'expensive-other', quantity: 1 },
        ],
        couponCodes: ['CATX50'],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.subtotal).toBe(1005);

      expect(result.couponDiscount).toBe(2.5);
      expect(result.total).toBe(1002.5);
    });

    it('order-independence: always validate with original subtotal (anti reordering attack — Gemini R4 Vuln 1)', async () => {

      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        salePrice: null,
      });
      couponsService.validate
        .mockResolvedValueOnce({
          discount: 30,
          value: 30,
          type: 'FIXED',
          couponId: 'cA',
          categoryId: null,
          tagId: null,
        })
        .mockResolvedValueOnce({
          discount: 20,
          value: 20,
          type: 'PERCENTAGE',
          couponId: 'cB',
          categoryId: null,
          tagId: null,
        });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['A30', 'B20PCT'],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      const calls = (couponsService.validate as jest.Mock).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0].cartValue).toBe(100);
      expect(calls[1][0].cartValue).toBe(100);
    });

    it('discount bleed: 2 FIXED $40 coupons for cat X with item $50 cat X + $1000 outside — total = $50, NOT $80 (Gemini R2 #1)', async () => {

      prisma.product.findUnique
        .mockResolvedValueOnce({
          ...mockProduct,
          id: 'cheap-x',
          type: 'simple',
          basePrice: 50,
          salePrice: null,
        })
        .mockResolvedValueOnce({
          ...mockProduct,
          id: 'expensive-other',
          type: 'simple',
          basePrice: 1000,
          salePrice: null,
        });

      prisma.productCategory.findMany
        .mockResolvedValueOnce([{ productId: 'cheap-x' }])
        .mockResolvedValueOnce([{ productId: 'cheap-x' }]);
      mockCategoriesService.getDescendantIds.mockResolvedValue([]);
      couponsService.validate
        .mockResolvedValueOnce({
          discount: 40,
          value: 40,
          type: 'FIXED',
          couponId: 'cFixA',
          categoryId: 'cat-x',
          tagId: null,
        })
        .mockResolvedValueOnce({
          discount: 40,
          value: 40,
          type: 'FIXED',
          couponId: 'cFixB',
          categoryId: 'cat-x',
          tagId: null,
        });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          { productId: 'cheap-x', quantity: 1 },
          { productId: 'expensive-other', quantity: 1 },
        ],
        couponCodes: ['FIXA40', 'FIXB40'],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.subtotal).toBe(1050);
      expect(result.couponDiscount).toBe(50);
      expect(result.total).toBe(1000);
      expect(result.appliedCoupons).toHaveLength(2);
      expect(result.appliedCoupons[0].discount).toBe(40);
      expect(result.appliedCoupons[1].discount).toBe(10);
    });

    it('duplicate codes are deduplicated (case insensitive)', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        salePrice: null,
      });
      couponsService.validate.mockResolvedValueOnce({
        discount: 10,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['DESC10', 'desc10', 'DESC10'],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(couponsService.validate).toHaveBeenCalledTimes(1);
      expect(result.appliedCoupons).toHaveLength(1);
    });

    it('variation + scale 75mm (+150%) + 10% coupon ', async () => {

      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        tags: [{ id: 'tag1' }],
      });
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [
          { id: 'item2', name: '75mm', percentageIncrease: 150, sortOrder: 1 },
        ],
      });
      scalesService.calculateScalePrice.mockReturnValue(124.75);
      couponsService.validate.mockResolvedValue({
        discount: 12.48,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(12.48);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          {
            productId: 'prod1',
            variationId: 'var1',
            scaleId: 'item2',
            quantity: 1,
          },
        ],
        couponCodes: ['DISCOUNT10'],
        shippingAmount: 18.5,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.items[0].basePrice).toBe(49.9);
      expect(result.items[0].scalePercentage).toBe(150);
      expect(result.items[0].unitPrice).toBe(124.75);
      expect(result.subtotal).toBe(124.75);
      expect(result.couponDiscount).toBe(12.48);
      expect(result.shipping).toBe(18.5);
      expect(result.paymentDiscount).toBe(12.48);

      expect(result.total).toBe(130.77);
    });

    it('QUOTE item + normal product + 10% coupon', async () => {

      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        salePrice: null,
      });

      mockCustomQuotesService.assertQuoteItemPurchasable.mockResolvedValue({
        id: 'qi1',
        status: 'QUOTED',
        unitPrice: 250,
        maxQuantity: 1,
        name: 'Custom Piece',
        description: null,
        weight: 0.5,
        width: 11,
        height: 16,
        length: 5,
        quote: {
          id: 'q1',
          status: 'SENT',
          expiresAt: new Date(Date.now() + 86_400_000),
          customerEmail: 'client@example.com',
          userId: null,
        },
      });

      couponsService.validate.mockResolvedValue({
        discount: 35,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(35);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        userEmail: 'client@example.com',
        items: [
          { productId: 'prod1', quantity: 1 },
          { quoteItemId: 'qi1', quantity: 1 },
        ],
        couponCodes: ['DEC10'],
        shippingAmount: 25,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.items[0].productId).toBe('prod1');
      expect(result.items[0].unitPrice).toBe(100);

      expect(result.items[1].quoteItemId).toBe('qi1');
      expect(result.items[1].productId).toBeUndefined();
      expect(result.items[1].unitPrice).toBe(250);
      expect(result.items[1].scalePercentage).toBe(0);

      expect(result.subtotal).toBe(350);

      expect(result.couponDiscount).toBe(35);

      expect(result.shipping).toBe(25);

      expect(result.paymentDiscount).toBe(35);

      expect(result.total).toBe(340);
    });

    it('same product 2x with different scales = separate lines', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [
          { id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 },
          { id: 'item2', name: '75mm', percentageIncrease: 150, sortOrder: 1 },
        ],
      });
      scalesService.calculateScalePrice
        .mockReturnValueOnce(49.9)
        .mockReturnValueOnce(124.75);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          {
            productId: 'prod1',
            variationId: 'var1',
            scaleId: 'item1',
            quantity: 1,
          },
          {
            productId: 'prod1',
            variationId: 'var1',
            scaleId: 'item2',
            quantity: 1,
          },
        ],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].unitPrice).toBe(49.9);
      expect(result.items[1].unitPrice).toBe(124.75);
      expect(result.subtotal).toBe(174.65);
    });

    it('total never negative (coupon greater than subtotal)', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 10,
      });
      couponsService.validate.mockResolvedValue({
        discount: 10,
        value: 10,
        type: 'FIXED',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['FIXED10'],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('free shipping ', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 200,
      });
      couponsService.validate.mockResolvedValue({
        discount: 0,
        value: 0,
        type: 'FREE_SHIPPING',
        couponId: 'c3',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(20);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['FREESHIPPING'],
        shippingAmount: 25,
        shippingZipCode: '01001000',
      });

      expect(result.isFreeShipping).toBe(true);
      expect(result.shipping).toBe(0);
      expect(result.paymentDiscount).toBe(20);
      expect(result.total).toBe(200);
    });

    it('multiple items with quantities + coupon + shipping', async () => {

      prisma.product.findUnique
        .mockResolvedValueOnce({
          ...mockProduct,
          type: 'simple',
          basePrice: 50,
          salePrice: null,
        })
        .mockResolvedValueOnce({
          ...mockProduct,
          id: 'prod2',
          type: 'simple',
          basePrice: 80,
          salePrice: 69,
        });
      couponsService.validate.mockResolvedValue({
        discount: 16.9,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          { productId: 'prod1', quantity: 2 },
          { productId: 'prod2', quantity: 1 },
        ],
        couponCodes: ['DESC10'],
        shippingAmount: 20,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.subtotal).toBe(169);
      expect(result.couponDiscount).toBe(16.9);

      expect(result.total).toBe(172.1);
    });
  });

  describe('coupon with category hierarchy', () => {
    it('should accept parent category coupon when product is in child category', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        tags: [],
      });
      couponsService.validate.mockResolvedValue({
        discount: 10,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c-hier',
        categoryId: 'parent-cat',
        tagId: null,
      });

      mockCategoriesService.getDescendantIds.mockResolvedValue([
        'child-cat',
        'grandchild-cat',
      ]);

      prisma.productCategory.findMany.mockResolvedValue([
        { productId: 'prod1' },
      ]);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCodes: ['HIERARCHY'],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.couponDiscount).toBe(10);
    });

    it('should reject coupon when product does not belong to any descendant category', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        tags: [],
      });
      couponsService.validate.mockResolvedValue({
        discount: 10,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c-hier',
        categoryId: 'parent-cat',
        tagId: null,
      });
      mockCategoriesService.getDescendantIds.mockResolvedValue(['child-cat']);

      prisma.productCategory.findMany.mockResolvedValue([
        { categoryId: 'unrelated-cat' },
      ]);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          couponCodes: ['HIERARCHY'],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveShipping — free shipping security', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        variations: [],
        tags: [],
        attributes: [],
      });
      scalesService.resolveScaleRule.mockResolvedValue(null);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);
    });

    it('should accept shipping=0 when ZIP qualifies for free shipping', async () => {
      mockShippingService.validateFreeShipping.mockResolvedValue(undefined);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.shipping).toBe(0);
      expect(mockShippingService.validateFreeShipping).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ productId: 'prod1', quantity: 1 }),
        ]),
        '01001000',
        100,
        undefined,
      );
    });

    it('should REJECT shipping=0 when ZIP does NOT qualify', async () => {
      mockShippingService.validateFreeShipping.mockRejectedValueOnce(
        new BadRequestException('Free shipping not available'),
      );

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '30000000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('REJECTS shipping=0 without ZIP (Gemini #2 — bypass via zipCode falsy)', async () => {

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 0,
          shippingServiceId: 1,
        }),
      ).rejects.toThrow(/ZIP mandatory/i);
      expect(mockShippingService.validateFreeShipping).not.toHaveBeenCalled();
    });

    it('shipping > 0 — requote and validate via validateShippingPrice (anti-tampering Rule #6)', async () => {
      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 25.5,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.shipping).toBe(25.5);
      expect(mockShippingService.validateFreeShipping).not.toHaveBeenCalled();
      expect(mockShippingService.validateShippingPrice).toHaveBeenCalledWith(
        expect.any(Array),
        '01001000',
        1,
        25.5,
        undefined,
      );
    });

    it('shipping > 0 without ZIP — REJECTS (Rule #6 does not trust frontend)', async () => {
      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 25.5,
          shippingServiceId: 1,
        }),
      ).rejects.toThrow(/ZIP mandatory to validate paid shipping/i);
    });

    it('shipping > 0 without serviceId — REJECTS (needs to know WHICH carrier to validate)', async () => {
      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 25.5,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(/Carrier.*mandatory/i);
    });

    it('shipping > 0 — backend uses REAL amount quoted by ME, not what client sent', async () => {

      mockShippingService.validateShippingPrice.mockRejectedValueOnce(
        new BadRequestException(
          'Quoted shipping changed (expected 13, current 13.5). Requote.',
        ),
      );
      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 13.0,
          shippingZipCode: '01001000',
          shippingServiceId: 1,
        }),
      ).rejects.toThrow(/quoted changed/i);
    });

    it('shipping > 0 — service not quoted (selected PAC, ME did not return PAC) -> REJECTS', async () => {
      mockShippingService.validateShippingPrice.mockRejectedValueOnce(
        new BadRequestException(
          'Selected shipping service is not available for this ZIP/items',
        ),
      );
      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 13.0,
          shippingZipCode: '01001000',
          shippingServiceId: 99,
        }),
      ).rejects.toThrow(/is not available/i);
    });

    it('shipping > 0 — backend uses verifiedAmount (ignores client in diff < 1cent)', async () => {

      mockShippingService.validateShippingPrice.mockResolvedValueOnce({
        verifiedAmount: 13.005,
      });
      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 13.0,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });
      expect(result.shipping).toBe(13.005);
    });

    it('should allow shipping=0 with FREE_SHIPPING coupon regardless of ZIP', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 0,
        value: 0,
        couponId: 'c1',
        type: 'FREE_SHIPPING',
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 15,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
        couponCodes: ['FREESHIPPING'],
      });

      expect(result.shipping).toBe(0);
      expect(result.isFreeShipping).toBe(true);
      expect(mockShippingService.validateFreeShipping).not.toHaveBeenCalled();
    });
  });

  describe('SECURITY — reject data manipulation', () => {
    beforeEach(() => {

      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 50,
        salePrice: null,
        variations: [],
        attributes: [],
      });
      scalesService.resolveScaleRule.mockResolvedValue(null);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);
    });

    it('ignores price sent by frontend — uses database one', async () => {

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01000000',
      });

      expect(result.subtotal).toBe(50);
      expect(result.items[0].unitPrice).toBe(50);
    });

    it('recalculates lineTotal on server (quantity × database price)', async () => {
      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 3 }],
        shippingAmount: 0,
        shippingZipCode: '01000000',
      });

      expect(result.subtotal).toBe(150);
      expect(result.items[0].lineTotal).toBe(150);
    });

    it('rejects non-existent productId', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'fake-id', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects inactive product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        isActive: false,
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects variable without variationId (attacker omits to pay basePrice=0)', async () => {

      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        attributes: [],
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-existent variationId on product', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [
            { productId: 'prod1', variationId: 'non-existent-var', quantity: 1 },
          ],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses variation salePrice if exists (not full price)', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var2', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].unitPrice).toBe(69);
      expect(result.subtotal).toBe(69);
    });

    it('rejects non-existent scaleId in product scale rule', async () => {
      scalesService.resolveScaleRule.mockResolvedValue({
        items: [
          {
            id: 'scale-28mm',
            name: '28mm',
            percentageIncrease: 0,
            sortOrder: 0,
          },
        ],
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', scaleId: 'fake-scale', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });


    it('payment discount 0 for unknown method', async () => {
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01000000',
        paymentMethod: 'bitcoin',
      });

      expect(result.paymentDiscount).toBe(0);
    });

    it('rejects shipping 0 when ZIP does not qualify for free shipping', async () => {
      mockShippingService.validateFreeShipping.mockRejectedValueOnce(
        new BadRequestException('Free shipping not available'),
      );

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '90000000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts shipping 0 when ZIP qualifies for free shipping', async () => {
      mockShippingService.validateFreeShipping.mockResolvedValue(undefined);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01000000',
      });

      expect(result.shipping).toBe(0);
    });

    it('coupon with category restriction rejects if no cart item belongs', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 10,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: 'restricted-cat',
        tagId: null,
      });
      mockCategoriesService.getDescendantIds.mockResolvedValue(['child-cat1']);

      prisma.productCategory.findMany.mockResolvedValue([
        { categoryId: 'other-cat' },
      ]);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01000000',
          couponCodes: ['RESTRICTED_COUPON'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('coupon with tag restriction rejects if no item has the tag', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 10,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: 'special-tag',
      });

      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 50,
        tags: [{ id: 'other-tag' }],
        variations: [],
        attributes: [],
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01000000',
          couponCodes: ['TAG_COUPON'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('free shipping coupon (type FREE_SHIPPING) zeros shipping', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 0,
        value: 0,
        type: 'FREE_SHIPPING',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 30,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
        couponCodes: ['FREESHIPPING'],
      });

      expect(result.shipping).toBe(0);
      expect(result.isFreeShipping).toBe(true);
    });

    it('PERCENTAGE coupon with isFreeShipping applies discount AND zeros shipping', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 5,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
        isFreeShipping: true,
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 25,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
        couponCodes: ['SHIPPING_DISCOUNT'],
      });

      expect(result.couponDiscount).toBe(5);
      expect(result.shipping).toBe(0);
      expect(result.isFreeShipping).toBe(true);
    });

    it('total never becomes negative even with discount greater than subtotal', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 999,
        value: 999,
        type: 'FIXED',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01000000',
        couponCodes: ['ABSURD'],
      });

      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('paymentDiscount is informative — DOES NOT subtract from total (stays in Payment)', async () => {
      paymentsService.calculateMethodDiscount.mockResolvedValue(5);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 10,
        shippingZipCode: '01000000',
        shippingServiceId: 1,
      });

      expect(result.total).toBe(60);
      expect(result.paymentDiscount).toBe(5);
    });

    it('without paymentMethod returns paymentDiscount=0', async () => {
      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01000000',
      });

      expect(result.paymentDiscount).toBe(0);
      expect(paymentsService.calculateMethodDiscount).not.toHaveBeenCalled();
    });
  });

  describe('bundle products', () => {
    const bundleProduct = {
      id: 'bundle-1',
      name: 'Pilgrim Kit',
      basePrice: 0,
      salePrice: null,
      isActive: true,
      type: 'bundle',
      bundleDiscount: 10,
      tags: [],
      variations: [],
      attributes: [],
    };

    const childA = {
      id: 'child-a',
      basePrice: 50,
      salePrice: 40,
      isActive: true,
    };
    const childB = {
      id: 'child-b',
      basePrice: 30,
      salePrice: null,
      isActive: true,
    };

    beforeEach(() => {
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);
    });

    it('should calculate bundle price from components with discount', async () => {
      prisma.product.findUnique.mockResolvedValue(bundleProduct);
      prisma.bundleComponent.findMany.mockResolvedValue([
        { childProduct: childA, childVariation: null, quantity: 2 },
        { childProduct: childB, childVariation: null, quantity: 1 },
      ]);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'bundle-1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].basePrice).toBe(99);
      expect(result.items[0].unitPrice).toBe(99);
      expect(result.subtotal).toBe(99);
    });

    it('should apply scale to calculated bundle price', async () => {
      prisma.product.findUnique.mockResolvedValue(bundleProduct);
      prisma.bundleComponent.findMany.mockResolvedValue([
        { childProduct: childA, childVariation: null, quantity: 1 },
      ]);
      scalesService.resolveScaleRule.mockResolvedValue({
        items: [{ id: 'scale-75mm', name: '75mm', percentageIncrease: 50 }],
      });
      scalesService.calculateScalePrice.mockReturnValue(54);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'bundle-1', scaleId: 'scale-75mm', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].basePrice).toBe(36);
      expect(result.items[0].scalePercentage).toBe(50);
      expect(result.items[0].unitPrice).toBe(54);
    });

    it('should reject bundle with variationId', async () => {
      prisma.product.findUnique.mockResolvedValue(bundleProduct);
      prisma.bundleComponent.findMany.mockResolvedValue([
        { childProduct: childA, childVariation: null, quantity: 1 },
      ]);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [
            { productId: 'bundle-1', variationId: 'some-var', quantity: 1 },
          ],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle bundle + regular item in same order', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(bundleProduct)
        .mockResolvedValueOnce({
          ...mockProduct,
          type: 'simple',
          basePrice: 25,
          salePrice: null,
        });
      prisma.bundleComponent.findMany.mockResolvedValue([
        { childProduct: childB, childVariation: null, quantity: 1 },
      ]);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          { productId: 'bundle-1', quantity: 1 },
          { productId: 'prod1', quantity: 2 },
        ],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items).toHaveLength(2);
      expect(result.subtotal).toBe(77);
    });

    it('should reject bundle with soft-deleted childVariation', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...bundleProduct,
        bundleDiscount: 0,
      });
      prisma.bundleComponent.findMany.mockResolvedValue([
        {
          childProduct: {
            id: 'child-var',
            name: 'Pilgrim',
            basePrice: 0,
            salePrice: null,
            isActive: true,
          },
          childVariation: {
            id: 'v1',
            price: 60,
            salePrice: 50,
            deletedAt: new Date(),
          },
          quantity: 1,
        },
      ]);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'bundle-1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject bundle with childProduct isActive=false', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...bundleProduct,
        bundleDiscount: 0,
      });
      prisma.bundleComponent.findMany.mockResolvedValue([
        {
          childProduct: {
            id: 'child-inactive',
            name: 'Inactive',
            basePrice: 30,
            salePrice: null,
            isActive: false,
          },
          childVariation: null,
          quantity: 1,
        },
      ]);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'bundle-1', quantity: 1 }],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use child variation when childVariation is defined', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...bundleProduct,
        bundleDiscount: 0,
      });
      prisma.bundleComponent.findMany.mockResolvedValue([
        {
          childProduct: { id: 'child-var', basePrice: 0, salePrice: null },
          childVariation: { id: 'v1', price: 60, salePrice: 50 },
          quantity: 1,
        },
      ]);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'bundle-1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].basePrice).toBe(50);
    });

    it('should include bundleComponents and bundleDiscount in VerifiedItem', async () => {
      prisma.product.findUnique.mockResolvedValue(bundleProduct);
      prisma.bundleComponent.findMany.mockResolvedValue([
        {
          childProduct: { ...childA, name: 'Pilgrim A' },
          childVariation: null,
          quantity: 2,
          childProductId: 'child-a',
          childVariationId: null,
        },
      ]);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'bundle-1', quantity: 1 }],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items[0].bundleDiscount).toBe(10);
      expect(result.items[0].bundleComponents).toHaveLength(1);
      expect(result.items[0].bundleComponents![0]).toMatchObject({
        childProductId: 'child-a',
        quantity: 2,
        unitPrice: 40,
      });
    });
  });

  describe('combinations — COMPLETE BUNDLE', () => {
    const bundleProduct = {
      id: 'bundle-combo',
      name: 'Combo Kit',
      basePrice: 0,
      salePrice: null,
      isActive: true,
      type: 'bundle',
      bundleDiscount: 20,
      tags: [{ id: 'tag1' }],
      variations: [],
      attributes: [],
    };

    it('bundle + scale + PERCENTAGE coupon  + paid shipping', async () => {
      prisma.product.findUnique.mockResolvedValue(bundleProduct);
      prisma.bundleComponent.findMany.mockResolvedValue([
        {
          childProduct: { id: 'c1', basePrice: 100, salePrice: null },
          childVariation: null,
          quantity: 1,
          childProductId: 'c1',
          childVariationId: null,
        },
        {
          childProduct: { id: 'c2', basePrice: 50, salePrice: null },
          childVariation: null,
          quantity: 2,
          childProductId: 'c2',
          childVariationId: null,
        },
      ]);

      scalesService.resolveScaleRule.mockResolvedValue({
        items: [{ id: 'scale-lg', name: '75mm', percentageIncrease: 50 }],
      });
      scalesService.calculateScalePrice.mockReturnValue(240);

      couponsService.validate.mockResolvedValue({
        discount: 24,
        value: 10,
        couponId: 'coup1',
        type: 'PERCENTAGE',
        isFreeShipping: false,
      });
      prisma.productCategory.findMany.mockResolvedValue([
        { categoryId: 'cat1' },
      ]);

      paymentsService.calculateMethodDiscount.mockResolvedValue(21.6);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          { productId: 'bundle-combo', scaleId: 'scale-lg', quantity: 1 },
        ],
        couponCodes: ['SAVE10'],
        shippingAmount: 15,
        shippingZipCode: '01000000',
        shippingServiceId: 1,
      });

      expect(result.items[0].basePrice).toBe(160);
      expect(result.items[0].unitPrice).toBe(240);
      expect(result.subtotal).toBe(240);
      expect(result.couponDiscount).toBe(24);
      expect(result.shipping).toBe(15);

      expect(result.total).toBe(231);
      expect(result.paymentDiscount).toBe(21.6);
    });

    it('gift: item isFreeGift generates unitPrice=0 and DOES NOT receive coupon discount', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce({
          ...mockProduct,
          id: 'normal',
          type: 'simple',
          basePrice: 100,
          salePrice: null,
        })
        .mockResolvedValueOnce({
          ...mockProduct,
          id: 'gift-prod',
          type: 'simple',
          basePrice: 80,
          salePrice: null,
        });
      couponsService.validate.mockResolvedValueOnce({
        discount: 10,
        value: 10,
        type: 'PERCENTAGE',
        couponId: 'cP',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          { productId: 'normal', quantity: 1 },
          { productId: 'gift-prod', quantity: 1, isFreeGift: true },
        ],
        couponCodes: ['PCT10'],
        shippingAmount: 10,
        shippingZipCode: '01001000',
        shippingServiceId: 1,
      });

      expect(result.subtotal).toBe(100);

      expect(result.couponDiscount).toBe(10);

      expect(result.items).toHaveLength(2);
      const giftItem = result.items.find((i) => i.productId === 'gift-prod');
      expect(giftItem?.unitPrice).toBe(0);
      expect(giftItem?.lineTotal).toBe(0);
      expect(giftItem?.isFreeGift).toBe(true);
      const normalItem = result.items.find((i) => i.productId === 'normal');
      expect(normalItem?.isFreeGift).toBeFalsy();

      expect(result.total).toBe(100);
    });

    it('gift: forces quantity=1 even if client sends > 1 (anti spoofing — Gemini R1 🔴 #1)', async () => {

      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        id: 'gift-prod',
        type: 'simple',
        basePrice: 80,
        salePrice: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          {
            productId: 'gift-prod',
            quantity: 50,
            isFreeGift: true,
            freeGiftId: 'cgift00000000000000000001',
          },
        ],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(1);
      expect(result.items[0].lineTotal).toBe(0);
    });

    it('gift: propagates freeGiftId to VerifiedItem (Gemini R1 🟡 #4)', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        id: 'gift-prod',
        type: 'simple',
        basePrice: 80,
        salePrice: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          {
            productId: 'gift-prod',
            quantity: 1,
            isFreeGift: true,
            freeGiftId: 'cgift00000000000000000001',
          },
        ],
        shippingAmount: 0,
        shippingZipCode: '01001000',
      });

      const giftItem = result.items[0] as { freeGiftId?: string };
      expect(giftItem.freeGiftId).toBe('cgift00000000000000000001');
    });

    it('gift: rejects gift item with variationId (gift = pure simple product)', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        id: 'gift-prod',
        type: 'simple',
        basePrice: 80,
        salePrice: null,
      });
      paymentsService.calculateMethodDiscount.mockResolvedValue(0);
      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [
            {
              productId: 'gift-prod',
              variationId: 'someVar',
              quantity: 1,
              isFreeGift: true,
            },
          ],
          shippingAmount: 0,
          shippingZipCode: '01001000',
        }),
      ).rejects.toThrow(/gift|simple/i);
    });
  });
});
