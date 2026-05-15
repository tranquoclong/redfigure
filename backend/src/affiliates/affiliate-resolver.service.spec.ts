import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateResolverService } from './affiliate-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

describe('AffiliateResolverService', () => {
  let service: AffiliateResolverService;
  let prisma: any;
  let settings: any;

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn() },
    };
    settings = {
      get: jest.fn().mockImplementation((k: string) => {
        if (k === 'affiliate_module_deployed_at')
          return Promise.resolve('2020-01-01T00:00:00Z');
        if (k === 'affiliate_exclude_self_referral')
          return Promise.resolve('true');
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateResolverService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
      ],
    }).compile();

    service = module.get<AffiliateResolverService>(AffiliateResolverService);
  });

  function mockOrder(overrides: Partial<any> = {}) {

    if ('coupon' in overrides) {
      const c = (overrides as any).coupon;
      delete (overrides as any).coupon;
      (overrides as any).coupons = c ? [{ coupon: c }] : [];
    }
    return {
      id: 'order-1',
      userId: 'user-buyer',
      createdAt: new Date('2026-04-01T10:00:00Z'),
      coupons: [],
      referringAffiliateId: null,
      referringAffiliate: null,
      ...overrides,
    };
  }

  describe('resolve (priority order)', () => {
    it('returns null if order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      const result = await service.resolve('order-nope');
      expect(result).toBeNull();
    });

    it('returns null if order created BEFORE module_deployed_at (retroactive cutoff)', async () => {
      settings.get.mockImplementation((k: string) => {
        if (k === 'affiliate_module_deployed_at')
          return Promise.resolve('2026-05-01T00:00:00Z');
        if (k === 'affiliate_exclude_self_referral')
          return Promise.resolve('true');
        return Promise.resolve(null);
      });
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          createdAt: new Date('2026-04-01T10:00:00Z'),
          referringAffiliateId: 'aff-1',
          referringAffiliate: {
            id: 'aff-1',
            status: 'APPROVED',
            userId: 'aff-user',
          },
        }),
      );

      const result = await service.resolve('order-1');
      expect(result).toBeNull();
    });

    it('CUPOM with APPROVED affiliate wins over cookie (decision #4 from plan)', async () => {
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          coupon: {
            affiliateId: 'aff-coupon',
            affiliate: {
              id: 'aff-coupon',
              status: 'APPROVED',
              userId: 'aff-coupon-user',
            },
          },
          referringAffiliateId: 'aff-cookie',
          referringAffiliate: {
            id: 'aff-cookie',
            status: 'APPROVED',
            userId: 'aff-cookie-user',
          },
        }),
      );

      const result = await service.resolve('order-1');
      expect(result).toEqual({ affiliateId: 'aff-coupon', source: 'COUPON' });
    });

    it('coupon SEM affiliateId → cai for cookie', async () => {
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          coupon: { affiliateId: null, affiliate: null },
          referringAffiliateId: 'aff-cookie',
          referringAffiliate: {
            id: 'aff-cookie',
            status: 'APPROVED',
            userId: 'aff-cookie-user',
          },
        }),
      );

      const result = await service.resolve('order-1');
      expect(result).toEqual({
        affiliateId: 'aff-cookie',
        source: 'REFERRAL_COOKIE',
      });
    });

    it('coupon with SUSPENDED affiliate → does not use coupon, falls back to cookie', async () => {
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          coupon: {
            affiliateId: 'aff-coupon',
            affiliate: {
              id: 'aff-coupon',
              status: 'SUSPENDED',
              userId: 'aff-coupon-user',
            },
          },
          referringAffiliateId: 'aff-cookie',
          referringAffiliate: {
            id: 'aff-cookie',
            status: 'APPROVED',
            userId: 'aff-cookie-user',
          },
        }),
      );

      const result = await service.resolve('order-1');
      expect(result).toEqual({
        affiliateId: 'aff-cookie',
        source: 'REFERRAL_COOKIE',
      });
    });

    it('cookie affiliate SUSPENDED → returns null (no commission created)', async () => {
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          referringAffiliateId: 'aff-cookie',
          referringAffiliate: {
            id: 'aff-cookie',
            status: 'SUSPENDED',
            userId: 'aff-cookie-user',
          },
        }),
      );

      const result = await service.resolve('order-1');
      expect(result).toBeNull();
    });

    it('no coupon and no cookie → null', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());

      const result = await service.resolve('order-1');
      expect(result).toBeNull();
    });
  });

  describe('anti-self-referral', () => {
    it('cookie of own buying user → null (user buys with own link)', async () => {
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          userId: 'same-user',
          referringAffiliateId: 'aff-self',
          referringAffiliate: {
            id: 'aff-self',
            status: 'APPROVED',
            userId: 'same-user',
          },
        }),
      );

      const result = await service.resolve('order-1');
      expect(result).toBeNull();
    });

    it('coupon of own buying user → null (no gain in auto-purchase)', async () => {
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          userId: 'same-user',
          coupon: {
            affiliateId: 'aff-self',
            affiliate: {
              id: 'aff-self',
              status: 'APPROVED',
              userId: 'same-user',
            },
          },
          referringAffiliateId: 'aff-legit',
          referringAffiliate: {
            id: 'aff-legit',
            status: 'APPROVED',
            userId: 'other-user',
          },
        }),
      );

      const result = await service.resolve('order-1');
      expect(result).toEqual({
        affiliateId: 'aff-legit',
        source: 'REFERRAL_COOKIE',
      });
    });

    it('setting affiliate_exclude_self_referral = false → allows auto-referral', async () => {
      settings.get.mockImplementation((k: string) => {
        if (k === 'affiliate_module_deployed_at')
          return Promise.resolve('2020-01-01T00:00:00Z');
        if (k === 'affiliate_exclude_self_referral')
          return Promise.resolve('false');
        return Promise.resolve(null);
      });
      prisma.order.findUnique.mockResolvedValue(
        mockOrder({
          userId: 'same-user',
          referringAffiliateId: 'aff-self',
          referringAffiliate: {
            id: 'aff-self',
            status: 'APPROVED',
            userId: 'same-user',
          },
        }),
      );

      const result = await service.resolve('order-1');
      expect(result).toEqual({
        affiliateId: 'aff-self',
        source: 'REFERRAL_COOKIE',
      });
    });
  });
});
