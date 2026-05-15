import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateLedgerCronService } from './affiliate-ledger-cron.service';
import { AffiliateLedgerService } from './affiliate-ledger.service';
import { AffiliateFraudDetectorService } from './affiliate-fraud-detector.service';
import { computeLedgerHash } from './affiliate-ledger-hash';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

describe('AffiliateLedgerCronService', () => {
  let service: AffiliateLedgerCronService;
  let prisma: any;
  let ledger: any;
  let settings: any;
  let fraud: any;

  beforeEach(async () => {
    prisma = {
      affiliateCommission: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      affiliateLedgerEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      affiliateAccount: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    delete process.env.AFFILIATE_LEDGER_HMAC_SECRET;
    delete process.env.AFFILIATE_LEDGER_REQUIRE_HASH;
    ledger = {
      appendCreditForCommission: jest.fn(),
    };
    settings = {
      get: jest.fn().mockResolvedValue('7'),
    };
    fraud = {
      scanSuspiciousSessions: jest.fn().mockResolvedValue({ flaggedCount: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateLedgerCronService,
        { provide: PrismaService, useValue: prisma },
        { provide: AffiliateLedgerService, useValue: ledger },
        { provide: AffiliateFraudDetectorService, useValue: fraud },
        { provide: SettingsService, useValue: settings },
        {
          provide: 'REDIS_CONNECTION',
          useValue: { host: 'x', port: 0 },
        },
      ],
    }).compile();

    service = module.get(AffiliateLedgerCronService);
  });

  afterEach(async () => {

  });

  describe('processApprovals', () => {
    it('approves PENDING commissions whose order DELIVERED passed holdDays', async () => {
      prisma.affiliateCommission.findMany.mockResolvedValue([
        { id: 'c1' },
        { id: 'c2' },
      ]);

      await service.processApprovals();

      expect(ledger.appendCreditForCommission).toHaveBeenCalledTimes(2);
      expect(ledger.appendCreditForCommission).toHaveBeenCalledWith('c1');
      expect(ledger.appendCreditForCommission).toHaveBeenCalledWith('c2');
    });

    it('filters by order.status DELIVERED + deliveredAt <= cutoff', async () => {
      await service.processApprovals();
      const call = prisma.affiliateCommission.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('PENDING');
      expect(call.where.order.status).toBe('DELIVERED');
      expect(call.where.order.deliveredAt).toHaveProperty('lte');
    });

    it('uses holdDays from settings (default 7)', async () => {
      settings.get.mockResolvedValue('14');
      const before = Date.now();
      await service.processApprovals();
      const after = Date.now();

      const call = prisma.affiliateCommission.findMany.mock.calls[0][0];
      const cutoff: Date = call.where.order.deliveredAt.lte;

      const expected = before - 14 * 86400_000;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(expected - 1000);
      expect(cutoff.getTime()).toBeLessThanOrEqual(
        after - 14 * 86400_000 + 1000,
      );
    });

    it('uses keyset pagination (id: {gt:lastId}) in successive batches', async () => {

      const firstBatch = Array.from({ length: 500 }, (_, i) => ({
        id: `c${String(i + 1).padStart(4, '0')}`,
      }));
      const secondBatch = [{ id: 'c0501' }, { id: 'c0502' }, { id: 'c0503' }];

      prisma.affiliateCommission.findMany
        .mockResolvedValueOnce(firstBatch)
        .mockResolvedValueOnce(secondBatch)
        .mockResolvedValueOnce([]);

      await service.processApprovals();

      const call1 = prisma.affiliateCommission.findMany.mock.calls[0][0];
      expect(call1.where.id).toBeUndefined();
      expect(call1.take).toBe(500);

      const call2 = prisma.affiliateCommission.findMany.mock.calls[1][0];
      expect(call2.where.id).toEqual({ gt: 'c0500' });
      expect(call2.cursor).toBeUndefined();
    });

    it('ignores individual failure and continues the loop', async () => {
      prisma.affiliateCommission.findMany.mockResolvedValue([
        { id: 'c1' },
        { id: 'c2' },
        { id: 'c3' },
      ]);
      ledger.appendCreditForCommission
        .mockImplementationOnce(async () => { })
        .mockImplementationOnce(async () => {
          throw new Error('db fail');
        })
        .mockImplementationOnce(async () => { });

      await expect(service.processApprovals()).resolves.toBeUndefined();
      expect(ledger.appendCreditForCommission).toHaveBeenCalledTimes(3);
    });
  });

  describe('processInvariantCheck', () => {
    it('sums CREDIT-DEBIT per affiliate and compares with existing entries', async () => {

      prisma.$queryRaw.mockResolvedValue([]);
      const spy = jest.spyOn((service as any).logger, 'error');

      await service.processInvariantCheck();

      expect(spy).not.toHaveBeenCalled();
    });

    it('logs ERROR if any affiliate has negative balance (invariant broken)', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { affiliateId: 'aff-1', balance: '-50.00' },
      ]);
      const spy = jest.spyOn((service as any).logger, 'error');

      await service.processInvariantCheck();

      expect(spy).toHaveBeenCalled();
      const msg = spy.mock.calls[0][0] as string;
      expect(msg).toContain('aff-1');
      expect(msg).toContain('-50');
    });
  });

  describe('processChainIntegrity', () => {
    const SECRET = 'a'.repeat(40);

    afterEach(() => {
      delete process.env.AFFILIATE_LEDGER_HMAC_SECRET;
    });

    it('skips if secret is not set', async () => {
      const logSpy = jest.spyOn((service as any).logger, 'log');
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await service.processChainIntegrity();

      expect(errorSpy).not.toHaveBeenCalled();
      expect(
        logSpy.mock.calls.some((c) => String(c[0]).includes('skipped')),
      ).toBe(true);
    });

    it('valid chain + tip matches -> logs OK', async () => {
      process.env.AFFILIATE_LEDGER_HMAC_SECRET = SECRET;
      const createdAt = new Date('2026-04-24T00:00:00Z');
      const entry = {
        id: 'e1',
        affiliateId: 'aff-1',
        type: 'CREDIT',
        source: 'MANUAL_CREDIT',
        amount: { toString: () => '10.00' },
        orderId: null,
        commissionId: null,
        paymentId: null,
        reason: 'bonus',
        createdByUserId: 'admin',
        createdAt,
        prevHash: null,
        hash: '',
      };
      entry.hash = computeLedgerHash(
        {
          ...entry,
          amount: '10.00',
          type: 'CREDIT',
          source: 'MANUAL_CREDIT',
        } as any,
        null,
        SECRET,
      );
      prisma.affiliateAccount.findMany.mockResolvedValue([
        {
          id: 'aff-1',
          lastLedgerHash: entry.hash,
          lastLedgerEntryId: 'e1',
        },
      ]);
      prisma.affiliateLedgerEntry.findMany
        .mockResolvedValueOnce([entry])
        .mockResolvedValueOnce([]);
      const logSpy = jest.spyOn((service as any).logger, 'log');
      const errSpy = jest.spyOn((service as any).logger, 'error');

      await service.processChainIntegrity();

      expect(errSpy).not.toHaveBeenCalled();
      expect(logSpy.mock.calls.some((c) => String(c[0]).includes('OK'))).toBe(
        true,
      );
    });

    it('tail truncation (divergent tip) -> logs TAIL TRUNCATED', async () => {
      process.env.AFFILIATE_LEDGER_HMAC_SECRET = SECRET;
      prisma.affiliateAccount.findMany.mockResolvedValue([
        {
          id: 'aff-1',

          lastLedgerHash: 'f'.repeat(64),
          lastLedgerEntryId: 'e2-deleted',
        },
      ]);
      const createdAt = new Date('2026-04-24T00:00:00Z');
      const entry = {
        id: 'e1',
        affiliateId: 'aff-1',
        type: 'CREDIT',
        source: 'MANUAL_CREDIT',
        amount: { toString: () => '10.00' },
        orderId: null,
        commissionId: null,
        paymentId: null,
        reason: 'bonus',
        createdByUserId: 'admin',
        createdAt,
        prevHash: null,
        hash: '',
      };
      entry.hash = computeLedgerHash(
        {
          ...entry,
          amount: '10.00',
          type: 'CREDIT',
          source: 'MANUAL_CREDIT',
        } as any,
        null,
        SECRET,
      );
      prisma.affiliateLedgerEntry.findMany
        .mockResolvedValueOnce([entry])
        .mockResolvedValueOnce([]);
      const errSpy = jest.spyOn((service as any).logger, 'error');

      await service.processChainIntegrity();

      expect(errSpy).toHaveBeenCalled();
      const msg = errSpy.mock.calls[0][0] as string;
      expect(msg).toContain('TAIL TRUNCATED');
      expect(msg).toContain('aff-1');
    });

    it('tampered hash -> logs ERROR with affiliateId+entryId', async () => {
      process.env.AFFILIATE_LEDGER_HMAC_SECRET = SECRET;
      prisma.affiliateAccount.findMany.mockResolvedValue([
        { id: 'aff-1', lastLedgerHash: null, lastLedgerEntryId: null },
      ]);
      const entry = {
        id: 'e-tampered',
        affiliateId: 'aff-1',
        type: 'CREDIT',
        source: 'MANUAL_CREDIT',
        amount: { toString: () => '999.99' },
        orderId: null,
        commissionId: null,
        paymentId: null,
        reason: 'bonus',
        createdByUserId: 'admin',
        createdAt: new Date('2026-04-24T00:00:00Z'),
        prevHash: null,
        hash: 'deadbeef'.repeat(8),
      };
      prisma.affiliateLedgerEntry.findMany
        .mockResolvedValueOnce([entry])
        .mockResolvedValueOnce([]);
      const errSpy = jest.spyOn((service as any).logger, 'error');

      await service.processChainIntegrity();

      expect(errSpy).toHaveBeenCalled();
      const msg = errSpy.mock.calls[0][0] as string;
      expect(msg).toContain('aff-1');
      expect(msg).toContain('e-tampered');
    });
  });
});
