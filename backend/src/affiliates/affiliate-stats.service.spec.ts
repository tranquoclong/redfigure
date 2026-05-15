import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateStatsService } from './affiliate-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateLedgerService } from './affiliate-ledger.service';

describe('AffiliateStatsService', () => {
  let service: AffiliateStatsService;
  let prisma: any;
  let ledger: any;

  beforeEach(async () => {
    prisma = {
      affiliateCommission: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { commissionAmount: null } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      affiliateLedgerEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      affiliateVisit: {
        count: jest.fn().mockResolvedValue(0),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { subtotal: null } }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    ledger = { currentBalance: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateStatsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AffiliateLedgerService, useValue: ledger },
      ],
    }).compile();

    service = module.get(AffiliateStatsService);
  });

  describe('getDashboardStats', () => {
    const from = new Date('2026-04-01');
    const to = new Date('2026-04-23');

    it('returns all KPIs structured', async () => {
      prisma.affiliateCommission.aggregate.mockResolvedValue({
        _sum: { commissionAmount: '150.00' },
      });
      prisma.affiliateLedgerEntry.aggregate.mockResolvedValue({
        _sum: { amount: '100.00' },
      });
      prisma.affiliateVisit.count.mockResolvedValue(500);
      prisma.order.count.mockResolvedValue(25);
      prisma.order.aggregate.mockResolvedValue({
        _sum: { subtotal: '2500.00' },
      });

      const stats = await service.getDashboardStats({
        dateFrom: from,
        dateTo: to,
      });

      expect(stats).toEqual(
        expect.objectContaining({
          totalCommissions: expect.any(Number),
          paidCommissions: expect.any(Number),
          cancelledCommissions: expect.any(Number),
          totalAffiliateEarnings: expect.any(Number),
          totalVisits: 500,
          totalConversions: 25,
          conversionRate: expect.any(Number),
          avgConversionTimeHours: expect.any(Number),
        }),
      );
    });

    it('conversionRate = conversions / visits * 100 (0 if visits=0)', async () => {
      prisma.affiliateVisit.count.mockResolvedValue(0);
      prisma.order.count.mockResolvedValue(5);
      const stats = await service.getDashboardStats({
        dateFrom: from,
        dateTo: to,
      });
      expect(stats.conversionRate).toBe(0);
    });

    it('filters by affiliate if affiliateId is provided', async () => {
      await service.getDashboardStats({
        dateFrom: from,
        dateTo: to,
        affiliateId: 'aff-123',
      });

      const commCall = prisma.affiliateCommission.aggregate.mock.calls[0][0];
      expect(commCall.where).toEqual(
        expect.objectContaining({ affiliateId: 'aff-123' }),
      );
    });

    it('uses createdAt >= dateFrom AND <= dateTo range in period queries', async () => {
      await service.getDashboardStats({ dateFrom: from, dateTo: to });
      const commCall = prisma.affiliateCommission.aggregate.mock.calls[0][0];
      expect(commCall.where.createdAt).toEqual({ gte: from, lte: to });
    });
  });

  describe('getCommissionTimeSeries', () => {
    it('returns buckets per day (default)', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: new Date('2026-04-01'), total: '100.00' },
        { bucket: new Date('2026-04-02'), total: '200.00' },
      ]);

      const series = await service.getCommissionTimeSeries({
        dateFrom: new Date('2026-04-01'),
        dateTo: new Date('2026-04-23'),
        granularity: 'day',
      });

      expect(series).toHaveLength(2);
      expect(series[0]).toEqual(
        expect.objectContaining({
          date: expect.any(Date),
          total: 100,
        }),
      );
    });

    it('invalid granularity defaults to day', async () => {
      await service.getCommissionTimeSeries({
        dateFrom: new Date('2026-04-01'),
        dateTo: new Date('2026-04-23'),
        granularity: 'xpto' as any,
      });
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('getTopProducts', () => {
    it('groups by productId and sums commissionAmount', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          productId: 'p1',
          productName: 'product 1',
          totalCommissions: '50.00',
          totalOrders: BigInt(10),
        },
      ]);
      const result = await service.getTopProducts({
        dateFrom: new Date('2026-04-01'),
        dateTo: new Date('2026-04-23'),
        limit: 10,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          productId: 'p1',
          productName: 'product 1',
          totalCommissions: 50,
          totalOrders: 10,
        }),
      );
    });
  });

  describe('getTopAffiliates', () => {
    it('groups by affiliateId and orders by commissions desc', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          affiliateId: 'a1',
          name: 'affiliate 1',
          email: 'a1@x.com',
          publicId: 1,
          totalCommissions: '200.00',
          totalOrders: BigInt(5),
        },
      ]);
      const result = await service.getTopAffiliates({
        dateFrom: new Date('2026-04-01'),
        dateTo: new Date('2026-04-23'),
        limit: 10,
      });
      expect(result[0]).toEqual(
        expect.objectContaining({
          affiliateId: 'a1',
          name: 'affiliate 1',
          publicId: 1,
          totalCommissions: 200,
          totalOrders: 5,
        }),
      );
    });
  });

  describe('range guard (anti-DoS)', () => {
    it('rejects dateFrom > dateTo', async () => {
      await expect(
        service.getDashboardStats({
          dateFrom: new Date('2026-04-23'),
          dateTo: new Date('2026-04-01'),
        }),
      ).rejects.toThrow(/dateFrom.*dateTo/);
    });

    it('rejects range > 366 dias (attacker tries 1970-2099)', async () => {
      await expect(
        service.getDashboardStats({
          dateFrom: new Date('1970-01-01'),
          dateTo: new Date('2099-12-31'),
        }),
      ).rejects.toThrow(/Range maximo/);
    });

    it('rejects range > 366 days in getTopProducts too', async () => {
      await expect(
        service.getTopProducts({
          dateFrom: new Date('2020-01-01'),
          dateTo: new Date('2026-04-23'),
          limit: 10,
        }),
      ).rejects.toThrow(/Range maximo/);
    });

    it('accepts exactly 365 days (upper limit ok)', async () => {
      const from = new Date('2026-01-01');
      const to = new Date(from.getTime() + 365 * 86400_000);
      await expect(
        service.getDashboardStats({ dateFrom: from, dateTo: to }),
      ).resolves.toBeDefined();
    });
  });

  describe('getAffiliateOverview', () => {
    it('returns balance + pending/approved/cancelled commissions for affiliate', async () => {
      ledger.currentBalance.mockResolvedValue(123.45);
      prisma.affiliateCommission.aggregate
        .mockResolvedValueOnce({ _sum: { commissionAmount: '80.00' } })
        .mockResolvedValueOnce({ _sum: { commissionAmount: '20.00' } })
        .mockResolvedValueOnce({ _sum: { commissionAmount: '5.00' } });
      prisma.affiliateLedgerEntry.aggregate.mockResolvedValue({
        _sum: { amount: '50.00' },
      });
      prisma.affiliateVisit.count.mockResolvedValue(300);
      prisma.order.count.mockResolvedValue(8);

      const stats = await service.getAffiliateOverview('aff-1');

      expect(stats).toEqual(
        expect.objectContaining({
          currentBalance: 123.45,
          pendingCommissions: 80,
          approvedCommissions: 20,
          cancelledCommissions: 5,
          paidLifetime: 50,
          visits30d: 300,
          conversions30d: 8,
        }),
      );
    });
  });
});
