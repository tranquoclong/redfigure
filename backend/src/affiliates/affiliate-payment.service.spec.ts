import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AffiliatePaymentService } from './affiliate-payment.service';
import { AffiliateLedgerService } from './affiliate-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EmailQueueService } from '../email/email-queue.service';

describe('AffiliatePaymentService', () => {
  let service: AffiliatePaymentService;
  let prisma: any;
  let ledger: any;
  let settings: any;
  let email: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
      $queryRaw: jest.fn(),
      affiliatePaymentRequest: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(async ({ data }) => ({ id: 'req-1', ...data })),
        update: jest.fn(async ({ data }) => data),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      affiliatePayment: {
        create: jest.fn(async ({ data }) => ({ id: 'pay-1', ...data })),
      },
      affiliateAccount: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'aff-1',
          status: 'APPROVED',
          user: { id: 'user-1', email: 'a@x.com', name: 'affiliate' },
        }),
      },
    };
    ledger = {
      currentBalance: jest.fn().mockResolvedValue(150),
      appendDebitForPayment: jest.fn(),
    };
    settings = {
      get: jest.fn(async (key: string) => {
        if (key === 'affiliate_min_payout_amount') return '100.00';
        if (key === 'affiliate_notify_admin_new_payment_request') return 'true';
        if (key === 'low_stock_email_recipients') return 'admin@test.com';
        return null;
      }),
    };
    email = {
      enqueueAffiliatePaymentRequestAdmin: jest.fn().mockResolvedValue({}),
      enqueueAffiliatePaymentReceived: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliatePaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AffiliateLedgerService, useValue: ledger },
        { provide: SettingsService, useValue: settings },
        { provide: EmailQueueService, useValue: email },
      ],
    }).compile();

    service = module.get(AffiliatePaymentService);
  });

  describe('requestPayment', () => {
    it('creates PENDING PaymentRequest with current balance (does not zero)', async () => {
      prisma.affiliatePaymentRequest.findFirst.mockResolvedValue(null);
      ledger.currentBalance.mockResolvedValue(250);

      const req = await service.requestPayment('aff-1');

      const call = prisma.affiliatePaymentRequest.create.mock.calls[0][0];
      expect(call.data.affiliateId).toBe('aff-1');
      expect(call.data.status).toBe('PENDING');

      expect(call.data.amountRequested.toString()).toBe('250');
      expect(req.status).toBe('PENDING');
    });

    it('rejects if affiliate already has PENDING PaymentRequest', async () => {
      prisma.affiliatePaymentRequest.findFirst.mockResolvedValue({
        id: 'old-req',
        status: 'PENDING',
      });

      await expect(service.requestPayment('aff-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects if balance < min_payout_amount', async () => {
      prisma.affiliatePaymentRequest.findFirst.mockResolvedValue(null);
      ledger.currentBalance.mockResolvedValue(50);

      await expect(service.requestPayment('aff-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('sends admin email via enqueueAffiliatePaymentRequestAdmin', async () => {
      prisma.affiliatePaymentRequest.findFirst.mockResolvedValue(null);
      ledger.currentBalance.mockResolvedValue(150);

      await service.requestPayment('aff-1');

      expect(email.enqueueAffiliatePaymentRequestAdmin).toHaveBeenCalled();
    });

    it('skips admin email if notify=false setting', async () => {
      prisma.affiliatePaymentRequest.findFirst.mockResolvedValue(null);
      settings.get.mockImplementation(async (k: string) => {
        if (k === 'affiliate_min_payout_amount') return '100.00';
        if (k === 'affiliate_notify_admin_new_payment_request') return 'false';
        if (k === 'low_stock_email_recipients') return 'admin@test.com';
        return null;
      });

      await service.requestPayment('aff-1');

      expect(email.enqueueAffiliatePaymentRequestAdmin).not.toHaveBeenCalled();
    });
  });

  describe('recordPayment', () => {
    it('creates Payment + atomic appendDebit + updates request PARTIALLY_PAID', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'req-1',
          affiliateId: 'aff-1',
          amountRequested: '100.00',
          amountPaid: '0',
          status: 'PENDING',
        },
      ]);

      await service.recordPayment({
        affiliateId: 'aff-1',
        amount: 50,
        paidAt: new Date(),
        note: 'SEPAY TED 1234',
        paymentRequestId: 'req-1',
        createdByUserId: 'admin-1',
      });

      const pay = prisma.affiliatePayment.create.mock.calls[0][0];
      expect(pay.data.affiliateId).toBe('aff-1');
      expect(pay.data.paymentRequestId).toBe('req-1');
      expect(pay.data.createdByUserId).toBe('admin-1');
      expect(pay.data.amount.toString()).toBe('50');

      expect(ledger.appendDebitForPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          affiliateId: 'aff-1',
          amount: 50,
          paymentId: 'pay-1',
        }),
        expect.anything(),
      );

      const upd = prisma.affiliatePaymentRequest.update.mock.calls[0][0];
      expect(upd.where).toEqual({ id: 'req-1' });
      expect(upd.data.status).toBe('PARTIALLY_PAID');
      expect(upd.data.amountPaid.toString()).toBe('50');
    });

    it('marks request as PAID + completedAt if amountPaid reaches amountRequested', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'req-1',
          affiliateId: 'aff-1',
          amountRequested: '100.00',
          amountPaid: '50.00',
          status: 'PARTIALLY_PAID',
        },
      ]);

      await service.recordPayment({
        affiliateId: 'aff-1',
        amount: 50,
        paidAt: new Date(),
        paymentRequestId: 'req-1',
        createdByUserId: 'admin-1',
      });

      const upd = prisma.affiliatePaymentRequest.update.mock.calls[0][0];
      expect(upd.data.status).toBe('PAID');
      expect(upd.data.amountPaid.toString()).toBe('100');
      expect(upd.data.completedAt).toBeInstanceOf(Date);
    });

    it('rejects amountPaid + amount > amountRequested (CHECK DB-level)', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'req-1',
          affiliateId: 'aff-1',
          amountRequested: '100.00',
          amountPaid: '80.00',
          status: 'PARTIALLY_PAID',
        },
      ]);

      await expect(
        service.recordPayment({
          affiliateId: 'aff-1',
          amount: 50,
          paidAt: new Date(),
          paymentRequestId: 'req-1',
          createdByUserId: 'admin-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects if paymentRequest belongs to another affiliate', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'req-1',
          affiliateId: 'aff-OTHER',
          amountRequested: '100.00',
          amountPaid: '0',
          status: 'PENDING',
        },
      ]);

      await expect(
        service.recordPayment({
          affiliateId: 'aff-1',
          amount: 50,
          paidAt: new Date(),
          paymentRequestId: 'req-1',
          createdByUserId: 'admin-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts payment without paymentRequestId (admin pays ad-hoc)', async () => {
      await service.recordPayment({
        affiliateId: 'aff-1',
        amount: 50,
        paidAt: new Date(),
        createdByUserId: 'admin-1',
      });

      expect(prisma.affiliatePayment.create).toHaveBeenCalled();
      expect(ledger.appendDebitForPayment).toHaveBeenCalled();
      expect(prisma.affiliatePaymentRequest.update).not.toHaveBeenCalled();
    });

    it('sends affiliate email via enqueueAffiliatePaymentReceived', async () => {
      await service.recordPayment({
        affiliateId: 'aff-1',
        amount: 50,
        paidAt: new Date(),
        createdByUserId: 'admin-1',
      });
      expect(email.enqueueAffiliatePaymentReceived).toHaveBeenCalled();
    });
  });

  describe('cancelRequest (CAS atomic, Gemini R1)', () => {
    it('cancels PENDING → CANCELLED with reason via updateMany atomic', async () => {
      prisma.affiliatePaymentRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliatePaymentRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'CANCELLED',
      });

      await service.cancelRequest('req-1', {
        reason: 'Duplicado',
        cancelByUserId: 'admin-1',
      });

      expect(prisma.affiliatePaymentRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'req-1',
            status: 'PENDING',
          }),
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelReason: 'Duplicado',
            cancelledAt: expect.any(Date),
          }),
        }),
      );
    });

    it('rejects if request is already PAID (count=0 after updateMany)', async () => {
      prisma.affiliatePaymentRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.affiliatePaymentRequest.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        status: 'PAID',
      });

      await expect(
        service.cancelRequest('req-1', {
          reason: 'x',
          cancelByUserId: 'admin-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('Forbidden if affiliate tries to cancel another affiliate\'s request', async () => {
      prisma.affiliatePaymentRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.affiliatePaymentRequest.findUnique.mockResolvedValue({
        affiliateId: 'aff-1',
        status: 'PENDING',
      });

      await expect(
        service.cancelRequest('req-1', {
          reason: 'x',
          cancelByUserId: 'user-2',
          byAffiliateId: 'aff-OTHER',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404 if not exists', async () => {
      prisma.affiliatePaymentRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.affiliatePaymentRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.cancelRequest('req-99', {
          reason: 'x',
          cancelByUserId: 'a',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('byAffiliateId filters in updateMany WHERE (does not just validate after)', async () => {
      prisma.affiliatePaymentRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.affiliatePaymentRequest.findUnique.mockResolvedValue({
        status: 'CANCELLED',
      });

      await service.cancelRequest('req-1', {
        reason: 'x',
        cancelByUserId: 'user-1',
        byAffiliateId: 'aff-1',
      });

      const call = prisma.affiliatePaymentRequest.updateMany.mock.calls[0][0];
      expect(call.where.affiliateId).toBe('aff-1');
      expect(call.where.status).toBe('PENDING');
    });
  });

  describe('listRequestsForAffiliate', () => {
    it('orders by requestedAt desc', async () => {
      prisma.affiliatePaymentRequest.findMany = jest.fn().mockResolvedValue([]);
      await service.listRequestsForAffiliate('aff-1');
      const call = prisma.affiliatePaymentRequest.findMany.mock.calls[0][0];
      expect(call.where.affiliateId).toBe('aff-1');
      expect(call.orderBy).toEqual({ requestedAt: 'desc' });
    });
  });
});
