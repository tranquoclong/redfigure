import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateCommissionService } from './affiliate-commission.service';
import { AffiliateResolverService } from './affiliate-resolver.service';
import { AffiliateCommissionRulesService } from './affiliate-commission-rules.service';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AffiliateCommissionService', () => {
  let service: AffiliateCommissionService;
  let prisma: any;
  let resolver: any;
  let rules: any;

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn() },
      affiliateCommission: {
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
      },
      productCategory: { findMany: jest.fn().mockResolvedValue([]) },
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    resolver = {
      resolve: jest.fn(),
    };
    rules = {
      resolveRate: jest.fn().mockResolvedValue(5),
    };
    const categories = {
      getDescendantIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateCommissionService,
        { provide: AffiliateResolverService, useValue: resolver },
        { provide: AffiliateCommissionRulesService, useValue: rules },
        { provide: CategoriesService, useValue: categories },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AffiliateCommissionService>(
      AffiliateCommissionService,
    );
  });

  function mockOrder(overrides: Partial<any> = {}) {

    if ('coupon' in overrides) {
      const c = (overrides as any).coupon;
      delete (overrides as any).coupon;
      (overrides as any).coupons = c ? [{ coupon: c }] : [];
    }
    return {
      id: 'order-1',
      userId: 'buyer',
      subtotal: 100,
      discount: 0,
      coupons: [],
      items: [],
      ...overrides,
    };
  }

  function mockItem(overrides: Partial<any> = {}) {
    return {
      id: 'item-1',
      productId: 'prod-1',
      quantity: 1,
      price: 100,
      discount: 0,
      parentOrderItemId: null,
      product: { id: 'prod-1', type: 'simple' },
      ...overrides,
    };
  }

  describe('createForOrder', () => {
    it('skip se resolver returns null (no affiliate / cutoff / self-ref)', async () => {
      resolver.resolve.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(mockOrder());

      await service.createForOrder('order-1');

      expect(prisma.affiliateCommission.createMany).not.toHaveBeenCalled();
    });

    it('Creates 1 commission per simple item (no coupon, rate=5%)', async () => {
      resolver.resolve.mockResolvedValue({
        affiliateId: 'aff-1',
        source: 'REFERRAL_COOKIE',
      });
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          items: [mockItem({ id: 'i1', price: 100, quantity: 1 })],
        }),
      );

      await service.createForOrder('order-1');

      expect(prisma.affiliateCommission.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            affiliateId: 'aff-1',
            orderId: 'order-1',
            orderItemId: 'i1',
            source: 'REFERRAL_COOKIE',
            status: 'PENDING',
            baseAmount: 100,
            rate: 5,
            commissionAmount: 5,
          }),
        ],
        skipDuplicates: true,
      });
    });

    it('skips items where resolved rate=0 (explicit veto)', async () => {
      resolver.resolve.mockResolvedValue({
        affiliateId: 'aff-1',
        source: 'REFERRAL_COOKIE',
      });
      rules.resolveRate.mockResolvedValue(0);
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({ items: [mockItem()] }),
      );

      await service.createForOrder('order-1');

      expect(prisma.affiliateCommission.createMany).not.toHaveBeenCalled();
    });

    it('BUNDLE: skip OrderItem parent (type=bundle) AND create commission on children', async () => {
      resolver.resolve.mockResolvedValue({
        affiliateId: 'aff-1',
        source: 'REFERRAL_COOKIE',
      });
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          items: [
            mockItem({
              id: 'bundle-parent',
              productId: 'bundle-id',
              price: 150,
              product: { id: 'bundle-id', type: 'bundle' },
            }),
            mockItem({
              id: 'child-1',
              productId: 'child-prod-1',
              price: 50,
              parentOrderItemId: 'bundle-parent',
              product: { id: 'child-prod-1', type: 'simple' },
            }),
            mockItem({
              id: 'child-2',
              productId: 'child-prod-2',
              price: 80,
              parentOrderItemId: 'bundle-parent',
              product: { id: 'child-prod-2', type: 'simple' },
            }),
          ],
        }),
      );

      await service.createForOrder('order-1');

      expect(prisma.affiliateCommission.createMany).toHaveBeenCalledTimes(1);
      const data = prisma.affiliateCommission.createMany.mock.calls[0][0].data;
      expect(data).toHaveLength(2);
      expect(data.map((d: any) => d.orderItemId)).toEqual([
        'child-1',
        'child-2',
      ]);
    });

    it('QUOTE item (productId=null): skips (no rule for quote)', async () => {
      resolver.resolve.mockResolvedValue({
        affiliateId: 'aff-1',
        source: 'REFERRAL_COOKIE',
      });
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          items: [
            mockItem({
              id: 'quote-1',
              productId: null,
              product: null,
              price: 200,
            }),
          ],
        }),
      );

      await service.createForOrder('order-1');
      expect(prisma.affiliateCommission.createMany).not.toHaveBeenCalled();
    });

    it('CART-WIDE COUPON: prorates discount across items', async () => {
      resolver.resolve.mockResolvedValue({
        affiliateId: 'aff-1',
        source: 'COUPON',
      });
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          coupon: { id: 'c1', categoryId: null, tagId: null },
          discount: 30,
          items: [
            mockItem({ id: 'i1', price: 100 }),
            mockItem({ id: 'i2', price: 200, productId: 'prod-2' }),
          ],
        }),
      );

      await service.createForOrder('order-1');

      const data = prisma.affiliateCommission.createMany.mock.calls[0][0].data;
      expect(data).toHaveLength(2);

      expect(data[0].baseAmount).toBeCloseTo(90, 2);
      expect(data[0].commissionAmount).toBeCloseTo(4.5, 2);

      expect(data[1].baseAmount).toBeCloseTo(180, 2);
      expect(data[1].commissionAmount).toBeCloseTo(9, 2);
    });

    it('createMany with skipDuplicates — native idempotency (safe re-run)', async () => {
      resolver.resolve.mockResolvedValue({
        affiliateId: 'aff-1',
        source: 'REFERRAL_COOKIE',
      });
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          items: [
            mockItem({ id: 'i1' }),
            mockItem({ id: 'i2', productId: 'prod-2' }),
            mockItem({ id: 'i3', productId: 'prod-3' }),
          ],
        }),
      );

      await service.createForOrder('order-1');

      const call = prisma.affiliateCommission.createMany.mock.calls[0][0];
      expect(call.skipDuplicates).toBe(true);
      expect(call.data).toHaveLength(3);
    });

    it('commissionAmount rounded to 2 decimal places (cents)', async () => {
      resolver.resolve.mockResolvedValue({
        affiliateId: 'aff-1',
        source: 'REFERRAL_COOKIE',
      });
      rules.resolveRate.mockResolvedValue(3.33);
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({ items: [mockItem({ price: 99.99 })] }),
      );

      await service.createForOrder('order-1');

      const data = prisma.affiliateCommission.createMany.mock.calls[0][0].data;

      expect(data[0].commissionAmount).toBeCloseTo(3.33, 2);
    });

    it('commission cannot exceed baseAmount (math_sanity DB CHECK)', async () => {
      resolver.resolve.mockResolvedValue({
        affiliateId: 'aff-1',
        source: 'REFERRAL_COOKIE',
      });
      rules.resolveRate.mockResolvedValue(100);
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({ items: [mockItem({ price: 10 })] }),
      );

      await service.createForOrder('order-1');

      const data = prisma.affiliateCommission.createMany.mock.calls[0][0].data;
      expect(data[0].commissionAmount).toBeLessThanOrEqual(data[0].baseAmount);
    });

    it('clamp rate > 100 to 100 (defense-in-depth contra rule corrupt)', async () => {
      resolver.resolve.mockResolvedValue({
        affiliateId: 'aff-1',
        source: 'REFERRAL_COOKIE',
      });
      rules.resolveRate.mockResolvedValue(500);
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({ items: [mockItem({ price: 100 })] }),
      );

      await service.createForOrder('order-1');

      const data = prisma.affiliateCommission.createMany.mock.calls[0][0].data;
      expect(data[0].rate).toBe(100);
      expect(data[0].commissionAmount).toBe(100);
    });
  });
});
