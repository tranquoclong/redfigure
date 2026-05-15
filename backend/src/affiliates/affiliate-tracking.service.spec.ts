import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../redis/redis.service';

describe('AffiliateTrackingService', () => {
  let service: AffiliateTrackingService;
  let prisma: any;
  let settings: any;
  let redis: any;

  beforeEach(async () => {
    prisma = {
      affiliateAccount: { findUnique: jest.fn() },
      affiliateVisit: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    settings = {
      get: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          affiliate_enabled: 'true',
          affiliate_cookie_days: '30',
          affiliate_visit_dedup_seconds: '60',
          affiliate_visit_retention_days: '30',
          affiliate_log_ip: 'false',
        };
        return Promise.resolve(map[key] ?? null);
      }),
    };
    redis = {
      setNX: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateTrackingService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<AffiliateTrackingService>(AffiliateTrackingService);
  });

  describe('track', () => {
    const baseInput = {
      ref: '42',
      sessionId: 'sess-abc',
      landingUrl: '/p/product-x?ref=42',
      userAgent: 'Mozilla/5.0',
      ipAddress: '203.0.113.42',
    };

    beforeEach(() => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        publicId: 42,
        status: 'APPROVED',
      });
    });

    it('returns null if ref is invalid in BOTH formats (publicId and publicCode)', async () => {

      const result = await service.track({ ...baseInput, ref: '!!' });
      expect(result).toBeNull();
      expect(prisma.affiliateVisit.create).not.toHaveBeenCalled();
    });

    it('accepts ref as publicCode (custom slug, non-numeric)', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        publicId: 42,
        status: 'APPROVED',
      });
      const result = await service.track({ ...baseInput, ref: 'rafael' });
      expect(result).not.toBeNull();
      expect(prisma.affiliateAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publicCode: 'rafael' } }),
      );
    });

    it('publicCode normalizes to lowercase', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        publicId: 42,
        status: 'APPROVED',
      });
      await service.track({ ...baseInput, ref: 'RAFAEL' });
      expect(prisma.affiliateAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publicCode: 'rafael' } }),
      );
    });

    it('publicCode < 3 chars is rejected', async () => {
      const result = await service.track({ ...baseInput, ref: 'ab' });
      expect(result).toBeNull();
    });

    it('numeric ref continues using publicId (does not fall into code)', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        publicId: 42,
        status: 'APPROVED',
      });
      await service.track({ ...baseInput, ref: '42' });
      expect(prisma.affiliateAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publicId: 42 } }),
      );
    });

    it('returns null if publicId does not exist or affiliate is not APPROVED', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue(null);
      const result = await service.track(baseInput);
      expect(result).toBeNull();
      expect(prisma.affiliateVisit.create).not.toHaveBeenCalled();
    });

    it('returns null if affiliate_enabled=false (kill switch)', async () => {
      settings.get.mockImplementation((k: string) =>
        k === 'affiliate_enabled'
          ? Promise.resolve('false')
          : Promise.resolve(null),
      );
      const result = await service.track(baseInput);
      expect(result).toBeNull();
      expect(prisma.affiliateAccount.findUnique).not.toHaveBeenCalled();
    });

    it('returns null if affiliate SUSPENDED (not APPROVED)', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        publicId: 42,
        status: 'SUSPENDED',
      });
      const result = await service.track(baseInput);
      expect(result).toBeNull();
    });

    it('creates visit + returns affiliateId+cookieValue when everything is valid', async () => {
      const result = await service.track(baseInput);

      expect(result).toEqual({
        affiliateId: 'aff-1',
        publicId: 42,
        cookieMaxAgeSeconds: 30 * 86400,
      });
      expect(prisma.affiliateVisit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          affiliateId: 'aff-1',
          sessionId: 'sess-abc',
          landingUrl: '/p/product-x?ref=42',
          userAgent: 'Mozilla/5.0',
          ipHash: null,
        }),
      });
    });

    it('dedup via Redis setNX (sessionId) — second visit does not recreate AffiliateVisit', async () => {
      redis.setNX.mockResolvedValueOnce(false);
      const result = await service.track(baseInput);

      expect(result).not.toBeNull();
      expect(prisma.affiliateVisit.create).not.toHaveBeenCalled();
      expect(redis.setNX).toHaveBeenCalledWith(
        expect.stringContaining('aff:visit:aff-1:s:sess-abc'),
        expect.any(String),
        60,
      );
    });

    it('secondary dedup by IP — attacker rotating sessionId is still capped', async () => {

      redis.setNX
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      const result = await service.track(baseInput);

      expect(result).not.toBeNull();
      expect(prisma.affiliateVisit.create).not.toHaveBeenCalled();

      const secondCall = redis.setNX.mock.calls[1];
      expect(secondCall[0]).toMatch(/^aff:visit:aff-1:ip:/);
    });

    it('hashes IP (SHA256) only if affiliate_log_ip=true + salt set (LGPD)', async () => {
      const prevSalt = process.env.AFFILIATE_IP_HASH_SALT;
      process.env.AFFILIATE_IP_HASH_SALT = 'test-salt-xyz';
      try {
        settings.get.mockImplementation((k: string) => {
          const map: Record<string, string> = {
            affiliate_enabled: 'true',
            affiliate_cookie_days: '30',
            affiliate_visit_dedup_seconds: '60',
            affiliate_log_ip: 'true',
          };
          return Promise.resolve(map[k] ?? null);
        });

        await service.track(baseInput);

        const call = prisma.affiliateVisit.create.mock.calls[0][0];
        expect(call.data.ipHash).toBeTruthy();
        expect(call.data.ipHash).toHaveLength(64);
        expect(call.data.ipHash).not.toContain('203.0.113');
      } finally {
        process.env.AFFILIATE_IP_HASH_SALT = prevSalt;
      }
    });

    it('ipHash=null if AFFILIATE_IP_HASH_SALT absent (does not create hash with default salt — Gemini review R1)', async () => {
      const prevSalt = process.env.AFFILIATE_IP_HASH_SALT;
      delete process.env.AFFILIATE_IP_HASH_SALT;
      try {
        settings.get.mockImplementation((k: string) => {
          const map: Record<string, string> = {
            affiliate_enabled: 'true',
            affiliate_log_ip: 'true',
          };
          return Promise.resolve(map[k] ?? null);
        });

        await service.track(baseInput);

        const call = prisma.affiliateVisit.create.mock.calls[0][0];
        expect(call.data.ipHash).toBeNull();
      } finally {
        if (prevSalt !== undefined)
          process.env.AFFILIATE_IP_HASH_SALT = prevSalt;
      }
    });

    it('utm fields are truncated to 100 chars (payload DoS defense)', async () => {
      const huge = 'u'.repeat(500);
      await service.track({
        ...baseInput,
        utm: { source: huge, medium: huge, campaign: huge },
      });

      const call = prisma.affiliateVisit.create.mock.calls[0][0];
      expect(call.data.utmSource.length).toBeLessThanOrEqual(100);
      expect(call.data.utmMedium.length).toBeLessThanOrEqual(100);
      expect(call.data.utmCampaign.length).toBeLessThanOrEqual(100);
    });

    it('sessionId is truncated to 100 chars (Redis key size + DB bloat)', async () => {
      const huge = 'x'.repeat(500);
      await service.track({ ...baseInput, sessionId: huge });
      const call = prisma.affiliateVisit.create.mock.calls[0][0];
      expect(call.data.sessionId.length).toBeLessThanOrEqual(100);
    });

    it('sessionId absent → IP-based dedup still applies (defense-in-depth)', async () => {
      const result = await service.track({
        ...baseInput,
        sessionId: undefined,
      });
      expect(result).not.toBeNull();
      expect(prisma.affiliateVisit.create).toHaveBeenCalled();

      expect(redis.setNX).toHaveBeenCalledTimes(1);
      expect(redis.setNX.mock.calls[0][0]).toMatch(/^aff:visit:aff-1:ip:/);
    });

    it('utm fields are persisted if provided', async () => {
      await service.track({
        ...baseInput,
        utm: {
          source: 'facebook',
          medium: 'social',
          campaign: 'promo-jul',
          content: 'carrossel-1',
          term: 'miniaturas',
        },
      });

      expect(prisma.affiliateVisit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          utmSource: 'facebook',
          utmMedium: 'social',
          utmCampaign: 'promo-jul',
          utmContent: 'carrossel-1',
          utmTerm: 'miniaturas',
        }),
      });
    });

    it('persists userId if user is logged in (storefront + admin join)', async () => {
      await service.track({ ...baseInput, userId: 'user-7' });
      expect(prisma.affiliateVisit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-7' }),
      });
    });

    it('tolerant to visit create failure — returns cookieInfo anyway', async () => {

      prisma.affiliateVisit.create.mockRejectedValue(new Error('DB down'));
      const result = await service.track(baseInput);
      expect(result).not.toBeNull();
    });

    it('ref with whitespace/rare chars → parseInt tolerates or fails silently', async () => {
      const result = await service.track({ ...baseInput, ref: '   ' });
      expect(result).toBeNull();
    });

    it('landingUrl is truncated to reasonable limit (prevents payload DoS)', async () => {
      const huge = 'a'.repeat(5000);
      await service.track({ ...baseInput, landingUrl: huge });
      const call = prisma.affiliateVisit.create.mock.calls[0][0];
      expect(call.data.landingUrl.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('resolveReferringAffiliate', () => {
    it('returns affiliateId if cookie contains valid publicId + APPROVED affiliate', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        publicId: 42,
        status: 'APPROVED',
      });
      const result = await service.resolveReferringAffiliate('42');
      expect(result).toBe('aff-1');
    });

    it('returns null if cookie is not a valid number', async () => {
      const result = await service.resolveReferringAffiliate('not-a-number');
      expect(result).toBeNull();
    });

    it('returns null if affiliate is SUSPENDED (no longer assigns)', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        publicId: 42,
        status: 'SUSPENDED',
      });
      const result = await service.resolveReferringAffiliate('42');
      expect(result).toBeNull();
    });

    it('returns null if cookie is empty', async () => {
      const result = await service.resolveReferringAffiliate('');
      expect(result).toBeNull();
    });
  });

  describe('markVisitConverted', () => {
    it('updates latest visit for sessionId+affiliateId with convertedOrderId', async () => {
      prisma.affiliateVisit.updateMany.mockResolvedValue({ count: 1 });

      await service.markVisitConverted({
        affiliateId: 'aff-1',
        sessionId: 'sess-x',
        orderId: 'order-1',
      });

      expect(prisma.affiliateVisit.updateMany).toHaveBeenCalledWith({
        where: {
          affiliateId: 'aff-1',
          sessionId: 'sess-x',
          convertedOrderId: null,
        },
        data: {
          convertedOrderId: 'order-1',
          convertedAt: expect.any(Date),
        },
      });
    });

    it('does NOT fail if updateMany returns count=0 (visit expired by retention cron)', async () => {
      prisma.affiliateVisit.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.markVisitConverted({
          affiliateId: 'aff-1',
          sessionId: 'sess-x',
          orderId: 'order-1',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('pruneOldVisits', () => {
    it('deletes non-converted visits older than retention_days', async () => {
      prisma.affiliateVisit.deleteMany.mockResolvedValue({ count: 7 });

      const count = await service.pruneOldVisits();

      expect(count).toBe(7);
      expect(prisma.affiliateVisit.deleteMany).toHaveBeenCalledWith({
        where: {
          convertedOrderId: null,
          createdAt: { lt: expect.any(Date) },
        },
      });
    });

    it('DOES NOT delete converted visits (permanent audit)', async () => {
      prisma.affiliateVisit.deleteMany.mockResolvedValue({ count: 0 });
      await service.pruneOldVisits();
      const call = prisma.affiliateVisit.deleteMany.mock.calls[0][0];
      expect(call.where.convertedOrderId).toBe(null);
    });
  });

  describe('listVisitsForAffiliate', () => {
    it('returns paginated visits, orderBy createdAt DESC, with resolved conversion', async () => {
      prisma.affiliateVisit.findMany.mockResolvedValue([
        {
          id: 'v1',
          createdAt: new Date('2026-04-24T10:00:00Z'),
          landingUrl: '/p/pin-up-x?ref=1',
          utmSource: 'instagram',
          utmMedium: 'bio',
          utmCampaign: 'launch',
          utmContent: null,
          utmTerm: null,
          userAgent: 'Mozilla/5.0 (iPhone)',
          convertedOrderId: 'ord-1',
          convertedAt: new Date('2026-04-24T10:30:00Z'),
        },
        {
          id: 'v2',
          createdAt: new Date('2026-04-23T09:00:00Z'),
          landingUrl: '/?ref=1',
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null,
          userAgent: 'Mozilla/5.0 (Macintosh)',
          convertedOrderId: null,
          convertedAt: null,
        },
      ]);
      prisma.affiliateVisit.count.mockResolvedValue(2);
      prisma.order.findMany.mockResolvedValue([
        { id: 'ord-1', number: 'EP-000123' },
      ]);

      const result = await service.listVisitsForAffiliate('aff-1', {
        page: 1,
        perPage: 50,
      });

      expect(prisma.affiliateVisit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { affiliateId: 'aff-1' },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 50,
        }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: 'v1',
        landingUrl: '/p/pin-up-x?ref=1',
        utmSource: 'instagram',
        converted: true,
        orderNumber: 'EP-000123',
      });
      expect(result.data[1]).toMatchObject({
        id: 'v2',
        converted: false,
        orderNumber: null,
      });
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        perPage: 50,
        lastPage: 1,
      });
    });

    it('clamps perPage [1, 100] and page >= 1', async () => {
      await service.listVisitsForAffiliate('aff-1', {
        page: -99,
        perPage: 9999,
      });
      const call = prisma.affiliateVisit.findMany.mock.calls[0][0];
      expect(call.skip).toBe(0);
      expect(call.take).toBe(100);
    });

    it('defaults: page=1, perPage=50 when omitted', async () => {
      await service.listVisitsForAffiliate('aff-1', {});
      const call = prisma.affiliateVisit.findMany.mock.calls[0][0];
      expect(call.skip).toBe(0);
      expect(call.take).toBe(50);
    });

    it('does not expose ipHash or internal fields in the response (LGPD)', async () => {
      prisma.affiliateVisit.findMany.mockResolvedValue([
        {
          id: 'v1',
          createdAt: new Date(),
          landingUrl: '/',
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null,
          userAgent: 'UA',
          convertedOrderId: null,
          convertedAt: null,

          ipHash: 'abcd1234',
          sessionId: 'sess-xyz',
          userId: 'user-1',
        },
      ]);
      prisma.affiliateVisit.count.mockResolvedValue(1);

      const result = await service.listVisitsForAffiliate('aff-1', {});

      const row = result.data[0] as Record<string, unknown>;
      expect(row.ipHash).toBeUndefined();
      expect(row.sessionId).toBeUndefined();
      expect(row.userId).toBeUndefined();
    });

    it('order missing (conversion was recomputed for null ref) → orderNumber null', async () => {
      prisma.affiliateVisit.findMany.mockResolvedValue([
        {
          id: 'v1',
          createdAt: new Date(),
          landingUrl: '/',
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null,
          userAgent: 'UA',
          convertedOrderId: 'ord-removed',
          convertedAt: new Date(),
        },
      ]);
      prisma.affiliateVisit.count.mockResolvedValue(1);
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.listVisitsForAffiliate('aff-1', {});

      expect(result.data[0].converted).toBe(true);
      expect(result.data[0].orderNumber).toBeNull();
    });
  });
});
