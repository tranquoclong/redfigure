import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterService } from './newsletter.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NewsletterService', () => {
  let service: NewsletterService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterService,
        {
          provide: PrismaService,
          useValue: {
            newsletterSubscriber: {
              upsert: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(NewsletterService);
    prisma = module.get(PrismaService);
  });

  describe('subscribe', () => {
    it('upserts the email and stores source/ip/userAgent', async () => {
      (prisma.newsletterSubscriber.upsert as jest.Mock).mockResolvedValue({
        id: 'n1',
        email: 'foo@bar.com',
      });

      await service.subscribe({
        email: 'foo@bar.com',
        source: 'home',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
      });

      expect(prisma.newsletterSubscriber.upsert).toHaveBeenCalledWith({
        where: { email: 'foo@bar.com' },
        create: {
          email: 'foo@bar.com',
          source: 'home',
          ipAddress: '1.2.3.4',
          userAgent: 'Mozilla/5.0',
        },

        update: {
          unsubscribedAt: null,
        },
      });
    });

    it('lowercases and trims the email', async () => {
      (prisma.newsletterSubscriber.upsert as jest.Mock).mockResolvedValue({});
      await service.subscribe({ email: '  Foo@BAR.com  ', source: 'footer' });
      expect(prisma.newsletterSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'foo@bar.com' } }),
      );
    });

    it('returns idempotent success even if email already exists (no leak)', async () => {

      (prisma.newsletterSubscriber.upsert as jest.Mock).mockResolvedValue({
        id: 'n1',
      });
      const result = await service.subscribe({ email: 'foo@bar.com' });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('list', () => {
    it('returns paginated active subscribers ordered by createdAt desc', async () => {
      const stub = [
        { id: 'a', email: 'a@x.com', source: 'home', createdAt: new Date() },
      ];
      (prisma.newsletterSubscriber.findMany as jest.Mock).mockResolvedValue(
        stub,
      );
      (prisma.newsletterSubscriber.count as jest.Mock).mockResolvedValue(1);

      const result = await service.list({ page: 1, perPage: 20 });

      expect(prisma.newsletterSubscriber.findMany).toHaveBeenCalledWith({
        where: { unsubscribedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        data: stub,
        meta: { total: 1, page: 1, perPage: 20, lastPage: 1 },
      });
    });

    it('filters by email search (case insensitive)', async () => {
      (prisma.newsletterSubscriber.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.newsletterSubscriber.count as jest.Mock).mockResolvedValue(0);

      await service.list({ page: 1, perPage: 20, search: 'foo' });

      expect(prisma.newsletterSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            unsubscribedAt: null,
            email: { contains: 'foo', mode: 'insensitive' },
          },
        }),
      );
    });

    it('calculates lastPage correctly for multiple pages', async () => {
      (prisma.newsletterSubscriber.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.newsletterSubscriber.count as jest.Mock).mockResolvedValue(45);

      const result = await service.list({ page: 2, perPage: 20 });

      expect(prisma.newsletterSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.meta).toEqual({
        total: 45,
        page: 2,
        perPage: 20,
        lastPage: 3,
      });
    });
  });

  describe('stats', () => {
    it('returns total, last24h, last7d, last30d counts of ACTIVE subs', async () => {
      const counts = [120, 5, 18, 47];
      (prisma.newsletterSubscriber.count as jest.Mock)
        .mockResolvedValueOnce(counts[0])
        .mockResolvedValueOnce(counts[1])
        .mockResolvedValueOnce(counts[2])
        .mockResolvedValueOnce(counts[3]);

      const result = await service.stats();

      expect(prisma.newsletterSubscriber.count).toHaveBeenCalledTimes(4);
      expect(result).toEqual({
        total: 120,
        last24h: 5,
        last7d: 18,
        last30d: 47,
      });
    });
  });

  describe('unsubscribe (admin soft delete)', () => {
    it('sets unsubscribedAt to current date', async () => {
      (prisma.newsletterSubscriber.update as jest.Mock).mockResolvedValue({});
      await service.unsubscribe('n1');
      expect(prisma.newsletterSubscriber.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { unsubscribedAt: expect.any(Date) },
      });
    });
  });

  describe('exportCsv', () => {
    it('returns CSV string with header + escaped rows of active subscribers', async () => {
      (prisma.newsletterSubscriber.findMany as jest.Mock).mockResolvedValue([
        {
          email: 'foo@bar.com',
          source: 'home',
          createdAt: new Date('2026-04-08T12:00:00Z'),
        },
        {
          email: 'with,comma@x.com',
          source: null,
          createdAt: new Date('2026-04-08T13:00:00Z'),
        },
      ]);
      const csv = await service.exportCsv();

      const lines = csv.split('\n');
      expect(lines[0]).toBe('email,source,created_at');

      expect(lines[1]).toBe('foo@bar.com,home,2026-04-08T12:00:00.000Z');

      expect(lines[2]).toBe('"with,comma@x.com",,2026-04-08T13:00:00.000Z');
    });

    it('only exports active (non-unsubscribed) subscribers', async () => {
      (prisma.newsletterSubscriber.findMany as jest.Mock).mockResolvedValue([]);
      await service.exportCsv();
      expect(prisma.newsletterSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { unsubscribedAt: null },
        }),
      );
    });
  });
});
