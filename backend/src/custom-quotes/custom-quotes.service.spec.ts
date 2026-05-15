import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomQuotesService } from './custom-quotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../email/email-queue.service';
import { TurnstileService } from '../turnstile/turnstile.service';
import { SettingsService } from '../settings/settings.service';

describe('CustomQuotesService', () => {
  let service: CustomQuotesService;
  let prisma: any;
  let emailQueue: any;
  let turnstile: any;
  let settings: any;

  beforeEach(async () => {
    prisma = {
      customQuote: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      customQuoteItem: {
        create: jest.fn(),
        createMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      customQuoteImage: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((arg: any) =>
        typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
      ),
    };
    emailQueue = {
      enqueueCustomQuoteRequestAdmin: jest.fn().mockResolvedValue({}),
      enqueueCustomQuoteSentCustomer: jest.fn().mockResolvedValue({}),
    };
    turnstile = { verify: jest.fn().mockResolvedValue(true) };
    settings = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'custom_quote_validity_days') return Promise.resolve('14');
        if (key === 'custom_quote_max_images') return Promise.resolve('5');
        if (key === 'custom_quote_max_external_links')
          return Promise.resolve('5');
        if (key === 'low_stock_email_recipients')
          return Promise.resolve('admin@example.com');
        return Promise.resolve(null);
      }),
    };
    const configService = {
      get: jest.fn().mockReturnValue('admin@example.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomQuotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailQueueService, useValue: emailQueue },
        { provide: TurnstileService, useValue: turnstile },
        { provide: SettingsService, useValue: settings },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<CustomQuotesService>(CustomQuotesService);
  });

  const validRequest = {
    name: 'name',
    email: 'email@example.com',
    description: 'I want to print a Hulk miniature that I downloaded',
    turnstileToken: 'tok',
    acceptLgpd: true,
  };

  describe('requestPublic', () => {
    it('should create quote with status REQUESTED when form is valid', async () => {
      prisma.customQuote.create.mockResolvedValue({
        id: 'q1',
        number: 'ORC-abc123',
        token: 'tok',
        status: 'REQUESTED',
      });
      prisma.customQuote.findUnique.mockResolvedValue(null);

      await service.requestPublic(validRequest, '1.2.3.4');

      expect(prisma.customQuote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerEmail: 'email@example.com',
            customerName: 'name',
            status: 'REQUESTED',
          }),
        }),
      );
    });

    it('should reject when Turnstile fails (fail-closed)', async () => {
      turnstile.verify.mockResolvedValueOnce(false);

      await expect(
        service.requestPublic(validRequest, '1.2.3.4'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.customQuote.create).not.toHaveBeenCalled();
    });

    it('should reject when LGPD not accepted', async () => {
      await expect(
        service.requestPublic(
          { ...validRequest, acceptLgpd: false },
          '1.2.3.4',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should silently succeed when honeypot (website) is filled (anti-bot)', async () => {
      const result = await service.requestPublic(
        { ...validRequest, website: 'http://bot.example' },
        '1.2.3.4',
      );

      expect(result).toEqual(expect.objectContaining({ ok: true }));

      expect(prisma.customQuote.create).not.toHaveBeenCalled();
      expect(emailQueue.enqueueCustomQuoteRequestAdmin).not.toHaveBeenCalled();
    });

    it('should lowercase email and sanitize customer name', async () => {
      prisma.customQuote.create.mockResolvedValue({ id: 'q2' });
      prisma.customQuote.findUnique.mockResolvedValue(null);

      await service.requestPublic(
        { ...validRequest, email: 'email@example.COM', name: '  name  ' },
        '1.2.3.4',
      );

      const call = prisma.customQuote.create.mock.calls[0][0];
      expect(call.data.customerEmail).toBe('email@example.com');
      expect(call.data.customerName).toBe('John Doe');
    });

    it('anonymous DOES NOT link userId even if email matches existing user (anti-griefing Gemini R1 🟡)', async () => {

      prisma.customQuote.create.mockResolvedValue({ id: 'q3' });
      prisma.customQuote.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-x' });

      await service.requestPublic(validRequest, '1.2.3.4');

      const call = prisma.customQuote.create.mock.calls[0][0];
      expect(call.data.userId).toBeNull();
    });

    it('logged-in caller: ignores dto.email/name/phone and uses user from DB (anti-tampering)', async () => {

      prisma.customQuote.create.mockResolvedValue({ id: 'q4' });
      prisma.customQuote.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-A',
        name: 'Alice (DB)',
        email: 'alice@redfigure.com',
        phone: '0901234567',
      });

      await service.requestPublic(
        {
          ...validRequest,
          name: 'Attacker',
          email: 'victim@example.com',
          phone: '0901234567',
        },
        '1.2.3.4',
        { id: 'user-A' },
      );

      const call = prisma.customQuote.create.mock.calls[0][0];
      expect(call.data.userId).toBe('user-A');
      expect(call.data.customerEmail).toBe('alice@redfigure.com');
      expect(call.data.customerName).toBe('Alice (DB)');
      expect(call.data.customerPhone).toBe('0901234567');
    });

    it('Logged-in caller: rejects if userId no longer exists (session stale)', async () => {
      prisma.customQuote.create.mockResolvedValue({ id: 'q5' });
      prisma.customQuote.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.requestPublic(validRequest, '1.2.3.4', { id: 'user-deleted' }),
      ).rejects.toThrow();
    });

    it('anonymous: still requires name+email in DTO', async () => {

      await expect(
        service.requestPublic(
          {
            ...validRequest,
            name: undefined as unknown as string,
            email: undefined as unknown as string,
          },
          '1.2.3.4',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllForUser', () => {
    it('List of quotes from logged-in user, paginated', async () => {
      const mockQuotes = [
        {
          id: 'q1',
          number: 'ORC-aaa',
          status: 'SENT',
          token: 'tok-1',
          expiresAt: new Date('2026-06-01'),
          sentAt: new Date('2026-05-01'),
          createdAt: new Date('2026-04-30'),
          _count: { items: 3 },
        },
      ];
      prisma.customQuote.findMany.mockResolvedValue(mockQuotes);
      prisma.customQuote.count.mockResolvedValue(1);

      const result = await service.findAllForUser('user-A', {
        page: 1,
        perPage: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].number).toBe('ORC-aaa');
      expect(result.data[0].itemsCount).toBe(3);
      expect(result.meta.total).toBe(1);
      expect(prisma.customQuote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-A' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          skip: 0,
        }),
      );
    });

    it('Does not return adminNotes nor customerEmail (anti enumeration)', async () => {
      prisma.customQuote.findMany.mockResolvedValue([
        {
          id: 'q1',
          number: 'ORC-aaa',
          status: 'SENT',
          token: 'tok-1',
          expiresAt: new Date('2026-06-01'),
          sentAt: null,
          createdAt: new Date('2026-04-30'),
          _count: { items: 2 },
        },
      ]);
      prisma.customQuote.count.mockResolvedValue(1);

      const result = await service.findAllForUser('user-A', {
        page: 1,
        perPage: 20,
      });

      const dto = result.data[0] as Record<string, unknown>;
      expect(dto).not.toHaveProperty('adminNotes');
      expect(dto).not.toHaveProperty('customerEmail');
      expect(dto).not.toHaveProperty('userId');
    });

    it('caps perPage at 100 (anti-DoS)', async () => {
      prisma.customQuote.findMany.mockResolvedValue([]);
      prisma.customQuote.count.mockResolvedValue(0);

      await service.findAllForUser('user-A', { page: 1, perPage: 9999 });

      const call = prisma.customQuote.findMany.mock.calls[0][0];
      expect(call.take).toBeLessThanOrEqual(100);
    });
  });

  describe('createAdmin', () => {
    it('should create quote in DRAFT status when admin creates directly', async () => {
      prisma.customQuote.create.mockResolvedValue({
        id: 'q-draft',
        status: 'DRAFT',
      });
      prisma.customQuote.findUnique.mockResolvedValue(null);

      await service.createAdmin({
        customerName: 'Client X',
        customerEmail: 'x@example.com',
      });

      const call = prisma.customQuote.create.mock.calls[0][0];
      expect(call.data.status).toBe('DRAFT');
    });

    it('should accept validityDays override from admin', async () => {
      prisma.customQuote.create.mockResolvedValue({ id: 'q-draft' });
      prisma.customQuote.findUnique.mockResolvedValue(null);

      const before = Date.now();
      await service.createAdmin({
        customerName: 'Client',
        customerEmail: 'c@example.com',
        validityDays: 30,
      });

      const call = prisma.customQuote.create.mock.calls[0][0];
      const delta = call.data.expiresAt.getTime() - before;

      expect(delta).toBeGreaterThan(30 * 86_400_000 - 60_000);
      expect(delta).toBeLessThan(30 * 86_400_000 + 60_000);
    });
  });

  describe('send', () => {
    it('should transition to SENT status and set sentAt/expiresAt', async () => {
      prisma.customQuote.findUnique.mockResolvedValue({
        id: 'q1',
        status: 'DRAFT',
        customerEmail: 'c@example.com',
        customerName: 'Client',
        token: 'tok',
        number: 'ORC-x',
        items: [{ id: 'i1', name: 'Piece', unitPrice: 100 }],
      });
      prisma.customQuote.update.mockResolvedValue({
        id: 'q1',
        status: 'SENT',
        expiresAt: new Date(Date.now() + 14 * 86_400_000),
      });

      await service.send('q1');

      expect(prisma.customQuote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'q1' },
          data: expect.objectContaining({
            status: 'SENT',
            sentAt: expect.any(Date),
          }),
        }),
      );
      expect(emailQueue.enqueueCustomQuoteSentCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'c@example.com',
          quoteNumber: 'ORC-x',
          token: 'tok',
        }),
      );
    });

    it('should reject send if quote has no items', async () => {
      prisma.customQuote.findUnique.mockResolvedValue({
        id: 'q-empty',
        status: 'DRAFT',
        items: [],
      });

      await expect(service.send('q-empty')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject send if status is CANCELLED', async () => {
      prisma.customQuote.findUnique.mockResolvedValue({
        id: 'q-cancelled',
        status: 'CANCELLED',
        items: [{ id: 'i1' }],
      });

      await expect(service.send('q-cancelled')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByToken', () => {
    it('should return quote with items + images when SENT and not expired', async () => {
      const future = new Date(Date.now() + 86_400_000 * 7);
      prisma.customQuote.findUnique.mockResolvedValue({
        id: 'q1',
        token: 'valid-token',
        status: 'SENT',
        expiresAt: future,
        customerName: 'Client',
        customerEmail: 'c@example.com',
        userId: 'user-1',
        adminNotes: 'internal',
        items: [{ id: 'i1', name: 'Piece', unitPrice: 100, status: 'QUOTED' }],
        images: [],
        number: 'ORC-x',
      });

      const result = await service.findByToken('valid-token');

      expect(result).toEqual(
        expect.objectContaining({
          number: 'ORC-x',
          status: 'SENT',
          items: expect.any(Array),
        }),
      );

      expect(result).not.toHaveProperty('customerEmail');
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('adminNotes');
    });

    it('should reject with NotFoundException when token does not exist', async () => {
      prisma.customQuote.findUnique.mockResolvedValue(null);
      await expect(service.findByToken('bad-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject when quote is EXPIRED', async () => {
      prisma.customQuote.findUnique.mockResolvedValue({
        id: 'q1',
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 86_400_000),
        items: [],
      });
      await expect(service.findByToken('x')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when quote is CANCELLED', async () => {
      prisma.customQuote.findUnique.mockResolvedValue({
        id: 'q1',
        status: 'CANCELLED',
        items: [],
      });
      await expect(service.findByToken('x')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when quote is still REQUESTED/DRAFT (admin did not send yet)', async () => {
      prisma.customQuote.findUnique.mockResolvedValue({
        id: 'q1',
        status: 'REQUESTED',
        items: [],
      });
      await expect(service.findByToken('x')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertQuoteItemPurchasable (chamado pelo PricingService via cart)', () => {

    it('should reject when quoteItem does not exist', async () => {
      prisma.customQuoteItem.findUnique.mockResolvedValue(null);
      await expect(
        service.assertQuoteItemPurchasable('missing', 'user@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when quote is not SENT/PARTIALLY_ACCEPTED', async () => {
      prisma.customQuoteItem.findUnique.mockResolvedValue({
        id: 'i1',
        status: 'QUOTED',
        quote: {
          status: 'CANCELLED',
          expiresAt: new Date(Date.now() + 86400000),
          customerEmail: 'user@example.com',
        },
      });
      await expect(
        service.assertQuoteItemPurchasable('i1', 'user@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when quote has expired', async () => {
      prisma.customQuoteItem.findUnique.mockResolvedValue({
        id: 'i1',
        status: 'QUOTED',
        quote: {
          status: 'SENT',
          expiresAt: new Date(Date.now() - 1000),
          customerEmail: 'user@example.com',
        },
      });
      await expect(
        service.assertQuoteItemPurchasable('i1', 'user@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when item is already ACCEPTED', async () => {
      prisma.customQuoteItem.findUnique.mockResolvedValue({
        id: 'i1',
        status: 'ACCEPTED',
        quote: {
          status: 'PARTIALLY_ACCEPTED',
          expiresAt: new Date(Date.now() + 86400000),
          customerEmail: 'user@example.com',
        },
      });
      await expect(
        service.assertQuoteItemPurchasable('i1', 'user@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when email does not match owner (ForbiddenException)', async () => {
      prisma.customQuoteItem.findUnique.mockResolvedValue({
        id: 'i1',
        status: 'QUOTED',
        quote: {
          status: 'SENT',
          expiresAt: new Date(Date.now() + 86400000),
          customerEmail: 'owner@example.com',
          userId: null,
        },
      });
      await expect(
        service.assertQuoteItemPurchasable('i1', 'other@example.com'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return quoteItem when all checks pass', async () => {
      const item = {
        id: 'i1',
        status: 'QUOTED',
        unitPrice: 100,
        name: 'Piece',
        weight: 0.3,
        width: 11,
        height: 16,
        length: 5,
        quote: {
          status: 'SENT',
          expiresAt: new Date(Date.now() + 86400000),
          customerEmail: 'owner@example.com',
          userId: 'user-1',
        },
      };
      prisma.customQuoteItem.findUnique.mockResolvedValue(item);

      const result = await service.assertQuoteItemPurchasable(
        'i1',
        'owner@example.com',
      );
      expect(result).toBe(item);
    });
  });

  describe('expireOutdated (cron)', () => {
    it('should set status EXPIRED for SENT/PARTIALLY_ACCEPTED past expiresAt', async () => {
      prisma.customQuote.updateMany.mockResolvedValue({ count: 3 });

      await service.expireOutdated();

      expect(prisma.customQuote.updateMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['SENT', 'PARTIALLY_ACCEPTED'] },
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: 'EXPIRED' },
      });
    });
  });
});
