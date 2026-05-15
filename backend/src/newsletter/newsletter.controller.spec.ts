import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterController } from './newsletter.controller';
import { AdminNewsletterController } from './admin-newsletter.controller';
import { NewsletterService } from './newsletter.service';
import type { Response } from 'express';

describe('Newsletter controllers', () => {
  let publicCtrl: NewsletterController;
  let adminCtrl: AdminNewsletterController;
  let service: jest.Mocked<NewsletterService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsletterController, AdminNewsletterController],
      providers: [
        {
          provide: NewsletterService,
          useValue: {
            subscribe: jest.fn(),
            list: jest.fn(),
            stats: jest.fn(),
            unsubscribe: jest.fn(),
            exportCsv: jest.fn(),
          },
        },
      ],
    }).compile();

    publicCtrl = module.get(NewsletterController);
    adminCtrl = module.get(AdminNewsletterController);
    service = module.get(NewsletterService);
  });

  describe('POST /api/v1/newsletter/subscribe', () => {
    it('delegates to service.subscribe with email + source + ip + ua', async () => {
      service.subscribe.mockResolvedValue({ ok: true });
      const fakeReq = {
        ip: '203.0.113.5',
        headers: { 'user-agent': 'CustomAgent/1.0' },
      } as unknown as Parameters<typeof publicCtrl.subscribe>[1];

      const result = await publicCtrl.subscribe(
        { email: 'foo@bar.com', source: 'home' },
        fakeReq,
      );

      expect(service.subscribe).toHaveBeenCalledWith({
        email: 'foo@bar.com',
        source: 'home',
        ipAddress: '203.0.113.5',
        userAgent: 'CustomAgent/1.0',
      });
      expect(result).toEqual({ data: { ok: true } });
    });

    it('returns success even if service returns success (idempotency contract)', async () => {
      service.subscribe.mockResolvedValue({ ok: true });
      const result = await publicCtrl.subscribe({ email: 'a@b.com' }, {
        ip: '1.1.1.1',
        headers: {},
      } as unknown as Parameters<typeof publicCtrl.subscribe>[1]);
      expect(result).toEqual({ data: { ok: true } });
    });
  });

  describe('GET /api/v1/admin/newsletter/subscribers', () => {
    it('passes pagination + search to service and returns paged shape', async () => {
      const stub = {
        data: [
          {
            id: 'n1',
            email: 'a@b.com',
            source: 'home',
            createdAt: new Date(),
          },
        ],
        meta: { total: 1, page: 1, perPage: 20, lastPage: 1 },
      };
      service.list.mockResolvedValue(
        stub as Awaited<ReturnType<NewsletterService['list']>>,
      );

      const result = await adminCtrl.list('1', '20', 'foo');

      expect(service.list).toHaveBeenCalledWith({
        page: 1,
        perPage: 20,
        search: 'foo',
      });
      expect(result).toEqual(stub);
    });

    it('uses defaults for missing query params', async () => {
      service.list.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 20, lastPage: 1 },
      } as Awaited<ReturnType<NewsletterService['list']>>);

      await adminCtrl.list(undefined, undefined, undefined);

      expect(service.list).toHaveBeenCalledWith({
        page: 1,
        perPage: 20,
        search: undefined,
      });
    });
  });

  describe('GET /api/v1/admin/newsletter/stats', () => {
    it('wraps stats in { data }', async () => {
      const stub = { total: 10, last24h: 1, last7d: 3, last30d: 7 };
      service.stats.mockResolvedValue(stub);
      const result = await adminCtrl.stats();
      expect(result).toEqual({ data: stub });
    });
  });

  describe('DELETE /api/v1/admin/newsletter/:id', () => {
    it('soft-unsubscribes via service and returns success message', async () => {
      service.unsubscribe.mockResolvedValue();
      const result = await adminCtrl.unsubscribe('n1');
      expect(service.unsubscribe).toHaveBeenCalledWith('n1');
      expect(result).toEqual({ data: { message: 'Removed from list' } });
    });
  });

  describe('GET /api/v1/admin/newsletter/export.csv', () => {
    it('writes CSV with content-type and disposition attachment', async () => {
      service.exportCsv.mockResolvedValue(
        'email,source,created_at\nfoo@x.com,home,2026-04-08',
      );

      const sent: Record<string, unknown> = {};
      const fakeRes = {
        type: jest.fn(function (this: unknown, t: string) {
          sent.type = t;
          return this;
        }),
        setHeader: jest.fn((k: string, v: string) => {
          sent[k] = v;
        }),
        send: jest.fn((body: string) => {
          sent.body = body;
        }),
      } as unknown as Response;

      await adminCtrl.exportCsv(fakeRes);

      expect(service.exportCsv).toHaveBeenCalled();
      expect(sent.type).toBe('text/csv; charset=utf-8');
      expect(sent['Content-Disposition']).toContain('attachment');
      expect(sent['Content-Disposition']).toContain('newsletter');
      expect(sent.body).toContain('foo@x.com');
    });
  });
});
