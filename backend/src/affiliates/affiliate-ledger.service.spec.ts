import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AffiliateLedgerService } from './affiliate-ledger.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AffiliateLedgerService', () => {
  let service: AffiliateLedgerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const sql = strings.join('?');

        if (sql.includes('affiliate_accounts')) {
          return Promise.resolve([{ id: 'aff-1' }]);
        }

        return Promise.resolve([{ balance: '0' }]);
      }),
      affiliateCommission: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      affiliateLedgerEntry: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'entry-1',
          ...data,
        })),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
      affiliateAccount: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateLedgerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AffiliateLedgerService);
    service.onModuleInit();
  });

  describe('appendCreditForCommission (CAS atomic)', () => {
    it('atomic claim updateMany(status=PENDING) + create entry CREDIT/COMMISSION', async () => {
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        orderId: 'order-1',
        commissionAmount: '10.00',
      });

      await service.appendCreditForCommission('c1');

      expect(prisma.affiliateCommission.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'APPROVED' }),
        }),
      );
      const createCall = prisma.affiliateLedgerEntry.create.mock.calls[0][0];
      expect(createCall.data).toEqual(
        expect.objectContaining({
          affiliateId: 'aff-1',
          type: 'CREDIT',
          source: 'COMMISSION',
          commissionId: 'c1',
        }),
      );

      expect(createCall.data.amount.toString()).toBe('10.00');

      expect(createCall.data.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(createCall.data.createdAt).toBeInstanceOf(Date);
    });

    it('skips if claim returns count=0 (another worker won race OR status != PENDING)', async () => {
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 0 });

      await service.appendCreditForCommission('c1');

      expect(prisma.affiliateCommission.findUnique).not.toHaveBeenCalled();
      expect(prisma.affiliateLedgerEntry.create).not.toHaveBeenCalled();
    });

    it('defensive skip if findUnique returns null after claim (unexpected inconsistency)', async () => {
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliateCommission.findUnique.mockResolvedValue(null);

      await service.appendCreditForCommission('c1');
      expect(prisma.affiliateLedgerEntry.create).not.toHaveBeenCalled();
    });

    it('rejects commissionAmount <= 0 (defense-in-depth contra commission corrompida)', async () => {
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        orderId: 'order-1',
        commissionAmount: '0',
      });

      await expect(service.appendCreditForCommission('c1')).rejects.toThrow(
        /Invalid commissionAmount/i,
      );
      expect(prisma.affiliateLedgerEntry.create).not.toHaveBeenCalled();
    });

    it('passes Decimal directly to ledger (preserves precision — without Number() lossy)', async () => {
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 1 });
      const decimalLike = '1234567890.99';
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        orderId: 'order-1',
        commissionAmount: decimalLike,
      });

      await service.appendCreditForCommission('c1');

      const createCall = prisma.affiliateLedgerEntry.create.mock.calls[0][0];
      expect(createCall.data.amount).toBe(decimalLike);
    });
  });

  describe('appendManualCredit', () => {
    it('requires non-empty reason', async () => {
      await expect(
        service.appendManualCredit({
          affiliateId: 'aff-1',
          amount: 25,
          reason: '',
          createdByUserId: 'admin-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates CREDIT/MANUAL_CREDIT entry with reason + createdByUserId', async () => {
      await service.appendManualCredit({
        affiliateId: 'aff-1',
        amount: 25,
        reason: 'bonus de campanha X',
        createdByUserId: 'admin-1',
      });

      const createCall = prisma.affiliateLedgerEntry.create.mock.calls[0][0];
      expect(createCall.data).toEqual(
        expect.objectContaining({
          affiliateId: 'aff-1',
          type: 'CREDIT',
          source: 'MANUAL_CREDIT',
          reason: 'campaign bonus X',
          createdByUserId: 'admin-1',
        }),
      );
      expect(createCall.data.amount.toString()).toBe('25');
    });

    it('rejects amount <= 0 (CHECK amount_positive do banco)', async () => {
      await expect(
        service.appendManualCredit({
          affiliateId: 'aff-1',
          amount: 0,
          reason: 'x',
          createdByUserId: 'a',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.appendManualCredit({
          affiliateId: 'aff-1',
          amount: -5,
          reason: 'x',
          createdByUserId: 'a',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('appendDebitForPayment', () => {

    function mockDebitQueries(opts: {
      affiliateExists?: boolean;
      balance: string;
    }) {
      const affiliateExists = opts.affiliateExists ?? true;
      prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('affiliate_accounts')) {
          return Promise.resolve(affiliateExists ? [{ id: 'aff-1' }] : []);
        }
        return Promise.resolve([{ balance: opts.balance }]);
      });
    }

    it('throws ConflictException if insufficient funds are available', async () => {
      mockDebitQueries({ balance: '50.00' });

      await expect(
        service.appendDebitForPayment({
          affiliateId: 'aff-1',
          amount: 100,
          paymentId: 'pay-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.affiliateLedgerEntry.create).not.toHaveBeenCalled();
    });

    it('creates DEBIT if sufficient balance', async () => {
      mockDebitQueries({ balance: '100.00' });

      await service.appendDebitForPayment({
        affiliateId: 'aff-1',
        amount: 75,
        paymentId: 'pay-1',
      });

      const createCall = prisma.affiliateLedgerEntry.create.mock.calls[0][0];
      expect(createCall.data).toEqual(
        expect.objectContaining({
          type: 'DEBIT',
          source: 'PAYMENT',
          paymentId: 'pay-1',
        }),
      );
      expect(createCall.data.amount.toString()).toBe('75');
    });

    it('throws ConflictException if affiliate does not exist (empty FOR UPDATE)', async () => {
      mockDebitQueries({ affiliateExists: false, balance: '100.00' });

      await expect(
        service.appendDebitForPayment({
          affiliateId: 'aff-1',
          amount: 10,
          paymentId: 'pay-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.affiliateLedgerEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelPendingCommissionsForOrder', () => {
    it('updates only PENDING (APPROVED are immutable)', async () => {
      prisma.affiliateLedgerEntry.updateMany = jest.fn();
      prisma.affiliateCommission.updateMany = jest
        .fn()
        .mockResolvedValue({ count: 2 });

      await service.cancelPendingCommissionsForOrder('order-1');

      expect(prisma.affiliateCommission.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order-1', status: 'PENDING' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelledAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('currentBalance', () => {
    it('returns decimal number calculated from SQL', async () => {
      prisma.$queryRaw.mockResolvedValue([{ balance: '123.45' }]);
      const bal = await service.currentBalance('aff-1');
      expect(bal).toBe(123.45);
    });

    it('returns 0 if ledger is empty', async () => {
      prisma.$queryRaw.mockResolvedValue([{ balance: '0' }]);
      expect(await service.currentBalance('aff-1')).toBe(0);
    });

    it('returns 0 if query returned a row without balance (edge)', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      expect(await service.currentBalance('aff-1')).toBe(0);
    });
  });

  describe('hash chain (HMAC-SHA256)', () => {
    const SECRET = 'a'.repeat(40);

    beforeEach(() => {
      process.env.AFFILIATE_LEDGER_HMAC_SECRET = SECRET;
      service.onModuleInit();
    });

    afterEach(() => {
      delete process.env.AFFILIATE_LEDGER_HMAC_SECRET;
    });

    it('inserts hash + prevHash null on the first entry of the affiliate', async () => {
      prisma.affiliateLedgerEntry.findFirst.mockResolvedValue(null);
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        orderId: 'order-1',
        commissionAmount: '10.00',
      });

      await service.appendCreditForCommission('c1');

      const call = prisma.affiliateLedgerEntry.create.mock.calls[0][0];
      expect(call.data.prevHash).toBeNull();
      expect(call.data.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('chains: the second entry takes the previous hash as prevHash', async () => {
      prisma.affiliateLedgerEntry.findFirst.mockResolvedValue({
        hash: 'b'.repeat(64),
      });
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        orderId: 'order-1',
        commissionAmount: '10.00',
      });

      await service.appendCreditForCommission('c1');

      const call = prisma.affiliateLedgerEntry.create.mock.calls[0][0];
      expect(call.data.prevHash).toBe('b'.repeat(64));
      expect(call.data.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(call.data.hash).not.toBe('b'.repeat(64));
    });

    it('without configured secret, both hash and prevHash null (legacy mode)', async () => {
      delete process.env.AFFILIATE_LEDGER_HMAC_SECRET;
      service.onModuleInit();

      prisma.affiliateLedgerEntry.findFirst.mockResolvedValue({
        hash: 'b'.repeat(64),
      });
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        orderId: 'order-1',
        commissionAmount: '10.00',
      });

      await service.appendCreditForCommission('c1');

      const call = prisma.affiliateLedgerEntry.create.mock.calls[0][0];
      expect(call.data.prevHash).toBeNull();
      expect(call.data.hash).toBeNull();

      expect(prisma.affiliateLedgerEntry.findFirst).not.toHaveBeenCalled();
    });

    it('very short secret (<32 chars) rejects + falls back to legacy mode', () => {
      process.env.AFFILIATE_LEDGER_HMAC_SECRET = 'short';
      const spy = jest.spyOn((service as any).logger, 'warn');
      service.onModuleInit();
      expect(spy).toHaveBeenCalled();
      const msg = spy.mock.calls[0][0] as string;
      expect(msg).toContain('not set');
    });

    it('fail-closed when AFFILIATE_LEDGER_REQUIRE_HASH=true but secret is missing', () => {
      delete process.env.AFFILIATE_LEDGER_HMAC_SECRET;
      process.env.AFFILIATE_LEDGER_REQUIRE_HASH = 'true';
      expect(() => service.onModuleInit()).toThrow(/Halting/i);
      delete process.env.AFFILIATE_LEDGER_REQUIRE_HASH;
    });

    it('updates the tip of the chain in affiliate_accounts.lastLedgerHash in the same tx', async () => {
      prisma.affiliateLedgerEntry.findFirst.mockResolvedValue(null);
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        orderId: 'order-1',
        commissionAmount: '10.00',
      });

      await service.appendCreditForCommission('c1');

      expect(prisma.affiliateAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'aff-1' },
          data: expect.objectContaining({
            lastLedgerHash: expect.stringMatching(/^[0-9a-f]{64}$/),
            lastLedgerEntryId: expect.any(String),
          }),
        }),
      );
    });

    it('legacy mode (without secret) does not update tip in affiliate_accounts', async () => {
      delete process.env.AFFILIATE_LEDGER_HMAC_SECRET;
      service.onModuleInit();
      prisma.affiliateCommission.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliateCommission.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        orderId: 'order-1',
        commissionAmount: '10.00',
      });

      await service.appendCreditForCommission('c1');

      expect(prisma.affiliateAccount.update).not.toHaveBeenCalled();
    });
  });
});
