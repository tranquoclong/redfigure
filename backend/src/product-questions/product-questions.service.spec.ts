import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProductQuestionsService,
  formatPublicAuthorName,
} from './product-questions.service';
import { TurnstileService } from '../turnstile/turnstile.service';
import { EmailQueueService } from '../email/email-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

describe('ProductQuestionsService', () => {
  let service: ProductQuestionsService;
  let prisma: {
    productQuestion: Record<string, jest.Mock>;
    product: Record<string, jest.Mock>;
  };
  let turnstile: jest.Mocked<TurnstileService>;
  let queue: jest.Mocked<EmailQueueService>;

  beforeEach(async () => {
    prisma = {
      productQuestion: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductQuestionsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: TurnstileService,
          useValue: { verify: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: EmailQueueService,
          useValue: {
            enqueueProductQuestionReceived: jest
              .fn()
              .mockResolvedValue(undefined),
            enqueueProductQuestionAnswered: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            get: jest.fn().mockResolvedValue('admin@x.com'),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
      ],
    }).compile();

    service = module.get(ProductQuestionsService);
    turnstile = module.get(TurnstileService);
    queue = module.get(EmailQueueService);
  });

  const baseDto = {
    productId: 'prod-1',
    question: 'Qual o prazo desse product?',
    acceptLgpd: true,
  };

  const requestMeta = {
    ipAddress: '203.0.113.5',
    userAgent: 'Mozilla/5.0',
  };

  const mockProduct = {
    id: 'prod-1',
    name: 'Miniatura X',
    slug: 'miniatura-x',
    isActive: true,
    isDraft: false,
  };

  describe('ask — honeypot', () => {
    it('silent ok when honeypot filled (no DB, no Turnstile, no email)', async () => {
      const result = await service.ask(
        {
          ...baseDto,
          website: 'bot-fill',
          askerName: 'a',
          askerEmail: 'a@b.com',
        },
        null,
        requestMeta,
      );
      expect(result).toEqual({ ok: true });
      expect(prisma.productQuestion.create).not.toHaveBeenCalled();
      expect(turnstile.verify).not.toHaveBeenCalled();
      expect(queue.enqueueProductQuestionReceived).not.toHaveBeenCalled();
    });

    it('treats whitespace-only honeypot as filled', async () => {
      const result = await service.ask(
        { ...baseDto, website: '   ', askerName: 'a', askerEmail: 'a@b.com' },
        null,
        requestMeta,
      );
      expect(result).toEqual({ ok: true });
      expect(prisma.productQuestion.create).not.toHaveBeenCalled();
    });
  });

  describe('ask — LGPD', () => {
    it('throws when acceptLgpd !== true', async () => {
      await expect(
        service.ask(
          {
            ...baseDto,
            acceptLgpd: false,
            askerName: 'a',
            askerEmail: 'a@b.com',
            turnstileToken: 'tok',
          },
          null,
          requestMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ask — guest (not logged in)', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productQuestion.create.mockResolvedValue({ id: 'q1' });
    });

    it('requires askerName + askerEmail + turnstileToken', async () => {
      await expect(
        service.ask(
          { ...baseDto, askerEmail: 'a@b.com', turnstileToken: 'tok' },
          null,
          requestMeta,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.ask(
          { ...baseDto, askerName: 'a', turnstileToken: 'tok' },
          null,
          requestMeta,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.ask(
          { ...baseDto, askerName: 'a', askerEmail: 'a@b.com' },
          null,
          requestMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls Turnstile.verify with token + IP', async () => {
      await service.ask(
        {
          ...baseDto,
          askerName: 'John',
          askerEmail: 'john@x.com',
          turnstileToken: 'cf-tok',
        },
        null,
        requestMeta,
      );
      expect(turnstile.verify).toHaveBeenCalledWith('cf-tok', '203.0.113.5');
    });

    it('throws BadRequest when Turnstile invalid', async () => {
      turnstile.verify.mockResolvedValue(false);
      await expect(
        service.ask(
          {
            ...baseDto,
            askerName: 'a',
            askerEmail: 'a@b.com',
            turnstileToken: 'bad',
          },
          null,
          requestMeta,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.productQuestion.create).not.toHaveBeenCalled();
    });

    it('creates question with status PENDING, sanitized text, and trimmed/lowercased email', async () => {
      await service.ask(
        {
          ...baseDto,
          question: '  Qual <script>alert(1)</script>prazo?  ',
          askerName: '  John Doe  ',
          askerEmail: '  JOHN@X.COM ',
          turnstileToken: 'tok',
        },
        null,
        requestMeta,
      );
      const createArgs = prisma.productQuestion.create.mock.calls[0][0].data;
      expect(createArgs.question).not.toContain('<');
      expect(createArgs.question).not.toContain('script');
      expect(createArgs.question).toContain('prazo');
      expect(createArgs.askerName).toBe('John Doe');
      expect(createArgs.askerEmail).toBe('john@x.com');
      expect(createArgs.status).toBe('PENDING');
      expect(createArgs.userId).toBeUndefined();
      expect(createArgs.productId).toBe('prod-1');
      expect(createArgs.ipAddress).toBe('203.0.113.5');
    });

    it('enqueues admin notification email after create', async () => {
      await service.ask(
        {
          ...baseDto,
          askerName: 'Ana',
          askerEmail: 'ana@x.com',
          turnstileToken: 'tok',
        },
        null,
        requestMeta,
      );
      expect(queue.enqueueProductQuestionReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@x.com',
          askerName: 'Ana',
          askerEmail: 'ana@x.com',
          productName: 'Miniatura X',
        }),
      );
    });

    it('rejects when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.ask(
          {
            ...baseDto,
            askerName: 'a',
            askerEmail: 'a@b.com',
            turnstileToken: 'tok',
          },
          null,
          requestMeta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when product is draft/inactive', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });
      await expect(
        service.ask(
          {
            ...baseDto,
            askerName: 'a',
            askerEmail: 'a@b.com',
            turnstileToken: 'tok',
          },
          null,
          requestMeta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when sanitized question is empty', async () => {
      await expect(
        service.ask(
          {
            ...baseDto,
            question: '<script></script>   ',
            askerName: 'a',
            askerEmail: 'a@b.com',
            turnstileToken: 'tok',
          },
          null,
          requestMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ask — logged in', () => {
    const loggedUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Pedro Henrique',
    };

    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productQuestion.create.mockResolvedValue({ id: 'q1' });
    });

    it('skips Turnstile (no verify call)', async () => {
      await service.ask(
        { ...baseDto, turnstileToken: 'should-be-ignored' },
        loggedUser,
        requestMeta,
      );
      expect(turnstile.verify).not.toHaveBeenCalled();
    });

    it('ignores askerName/email from body, pulls from auth', async () => {
      await service.ask(
        {
          ...baseDto,
          askerName: 'evil-name',
          askerEmail: 'evil@attacker.com',
        },
        loggedUser,
        requestMeta,
      );
      const createArgs = prisma.productQuestion.create.mock.calls[0][0].data;
      expect(createArgs.askerName).toBe('Pedro Henrique');
      expect(createArgs.askerEmail).toBe('user@example.com');
      expect(createArgs.userId).toBe('user-1');
    });
  });

  describe('findPublicByProduct', () => {
    it('returns only ANSWERED questions with formatted author name + isOwn false for anon', async () => {
      prisma.productQuestion.findMany.mockResolvedValue([
        {
          id: 'q1',
          askerName: 'Rafael Pessoa',
          question: 'Prazo?',
          answer: '5 dias',
          answeredAt: new Date('2026-04-01'),
          createdAt: new Date('2026-03-30'),
          userId: 'owner-123',
        },
      ]);
      prisma.productQuestion.count.mockResolvedValue(1);

      const result = await service.findPublicByProduct('prod-1');

      expect(prisma.productQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod-1', status: 'ANSWERED' },
          orderBy: { answeredAt: 'desc' },
        }),
      );
      expect(result.data[0].askerName).toBe('Rafael P.');
      expect(result.data[0].isOwn).toBe(false);
      expect(result.data[0]).not.toHaveProperty('askerEmail');
      expect(result.data[0]).not.toHaveProperty('ipAddress');
      expect(result.data[0]).not.toHaveProperty('userAgent');
      expect(result.data[0]).not.toHaveProperty('userId');
    });

    it('sets isOwn=true when current user matches the asker', async () => {
      prisma.productQuestion.findMany.mockResolvedValue([
        {
          id: 'q1',
          askerName: 'Rafael Pessoa',
          question: 'Prazo?',
          answer: '5 dias',
          answeredAt: new Date(),
          createdAt: new Date(),
          userId: 'user-abc',
        },
      ]);
      prisma.productQuestion.count.mockResolvedValue(1);
      const result = await service.findPublicByProduct(
        'prod-1',
        1,
        10,
        'user-abc',
      );
      expect(result.data[0].isOwn).toBe(true);
    });

    it('isOwn always false when current user is guest (no userId)', async () => {
      prisma.productQuestion.findMany.mockResolvedValue([
        {
          id: 'q1',
          askerName: 'Rafael Pessoa',
          question: 'Prazo?',
          answer: '5 dias',
          answeredAt: new Date(),
          createdAt: new Date(),
          userId: null,
        },
      ]);
      prisma.productQuestion.count.mockResolvedValue(1);
      const result = await service.findPublicByProduct(
        'prod-1',
        1,
        10,
        'user-abc',
      );
      expect(result.data[0].isOwn).toBe(false);
    });

    it('returns empty list for non-existent product (no 404 — anti-enumeration)', async () => {
      prisma.productQuestion.findMany.mockResolvedValue([]);
      prisma.productQuestion.count.mockResolvedValue(0);
      const result = await service.findPublicByProduct('nonexistent');
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('answer (admin)', () => {
    const mockQuestion = {
      id: 'q1',
      productId: 'prod-1',
      askerName: 'Rafael',
      askerEmail: 'rafael@x.com',
      question: 'Prazo?',
      status: 'PENDING',
      product: { name: 'Miniatura X', slug: 'miniatura-x' },
    };

    beforeEach(() => {
      prisma.productQuestion.findUnique.mockResolvedValue(mockQuestion);
      prisma.productQuestion.update.mockResolvedValue({
        ...mockQuestion,
        answer: '5 dias',
        answeredAt: new Date(),
        status: 'ANSWERED',
      });
    });

    it('transitions PENDING → ANSWERED, stores sanitized answer + adminId', async () => {
      await service.answer('q1', '  <b>5</b> dias  ', 'admin-1');
      const updateArgs = prisma.productQuestion.update.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: 'q1' });
      expect(updateArgs.data.status).toBe('ANSWERED');
      expect(updateArgs.data.answer).not.toContain('<');
      expect(updateArgs.data.answer).toContain('5 dias');
      expect(updateArgs.data.answeredById).toBe('admin-1');
      expect(updateArgs.data.answeredAt).toBeInstanceOf(Date);
    });

    it('enqueues email to asker notifying answer', async () => {
      await service.answer('q1', 'Resposta detalhada', 'admin-1');
      expect(queue.enqueueProductQuestionAnswered).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'rafael@x.com',
          askerName: 'Rafael',
          productName: 'Miniatura X',
        }),
      );
    });

    it('throws 404 if question not found', async () => {
      prisma.productQuestion.findUnique.mockResolvedValue(null);
      await expect(
        service.answer('bad', 'resposta', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if answer sanitizes to empty', async () => {
      await expect(
        service.answer('q1', '<script></script>', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows re-answer of already-ANSWERED (admin can update)', async () => {
      prisma.productQuestion.findUnique.mockResolvedValue({
        ...mockQuestion,
        status: 'ANSWERED',
      });
      await expect(
        service.answer('q1', 'nova resposta', 'admin-1'),
      ).resolves.toBeDefined();
    });
  });

  describe('reject (admin)', () => {
    it('transitions to REJECTED without sending email to asker', async () => {
      prisma.productQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        status: 'PENDING',
      });
      prisma.productQuestion.update.mockResolvedValue({
        id: 'q1',
        status: 'REJECTED',
      });

      await service.reject('q1');

      expect(prisma.productQuestion.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: { status: 'REJECTED' },
      });
      expect(queue.enqueueProductQuestionAnswered).not.toHaveBeenCalled();
    });

    it('throws 404 if question not found', async () => {
      prisma.productQuestion.findUnique.mockResolvedValue(null);
      await expect(service.reject('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('admin deletes any question (hard delete)', async () => {
      prisma.productQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        userId: 'owner-123',
      });
      prisma.productQuestion.delete.mockResolvedValue({ id: 'q1' });

      await service.delete('q1', { id: 'admin-1', role: 'ADMIN' });

      expect(prisma.productQuestion.delete).toHaveBeenCalledWith({
        where: { id: 'q1' },
      });
    });

    it('owner deletes own question', async () => {
      prisma.productQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        userId: 'owner-123',
      });
      prisma.productQuestion.delete.mockResolvedValue({ id: 'q1' });

      await service.delete('q1', { id: 'owner-123', role: 'CUSTOMER' });

      expect(prisma.productQuestion.delete).toHaveBeenCalledWith({
        where: { id: 'q1' },
      });
    });

    it('rejects customer deleting someone else question (403)', async () => {
      prisma.productQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        userId: 'owner-123',
      });

      await expect(
        service.delete('q1', { id: 'other-user', role: 'CUSTOMER' }),
      ).rejects.toThrow();
      expect(prisma.productQuestion.delete).not.toHaveBeenCalled();
    });

    it('rejects customer deleting guest question (no userId)', async () => {
      prisma.productQuestion.findUnique.mockResolvedValue({
        id: 'q1',
        userId: null,
      });

      await expect(
        service.delete('q1', { id: 'some-user', role: 'CUSTOMER' }),
      ).rejects.toThrow();
      expect(prisma.productQuestion.delete).not.toHaveBeenCalled();
    });

    it('404 when question not found', async () => {
      prisma.productQuestion.findUnique.mockResolvedValue(null);
      await expect(
        service.delete('bad', { id: 'admin-1', role: 'ADMIN' }),
      ).rejects.toThrow();
    });
  });

  describe('countPending', () => {
    it('returns number of PENDING questions', async () => {
      prisma.productQuestion.count.mockResolvedValue(7);
      const result = await service.countPending();
      expect(prisma.productQuestion.count).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
      });
      expect(result).toEqual({ count: 7 });
    });
  });

  describe('findAllAdmin', () => {
    it('returns paginated with filters and RAW askerEmail (admin-only data)', async () => {
      prisma.productQuestion.findMany.mockResolvedValue([
        {
          id: 'q1',
          askerName: 'Rafael Pessoa',
          askerEmail: 'rafael@x.com',
          question: 'prazo?',
          status: 'PENDING',
          product: { name: 'Miniatura X', slug: 'miniatura-x' },
        },
      ]);
      prisma.productQuestion.count.mockResolvedValue(1);

      const result = await service.findAllAdmin({
        status: 'PENDING',
        page: 1,
        perPage: 20,
      });

      expect(prisma.productQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data[0].askerEmail).toBe('rafael@x.com');
      expect(result.data[0].askerName).toBe('Rafael Pessoa');
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        perPage: 20,
        lastPage: 1,
      });
    });
  });
});

describe('formatPublicAuthorName', () => {
  it('returns first + last initial for two names', () => {
    expect(formatPublicAuthorName('Rafael Pessoa')).toBe('Rafael P.');
  });

  it('handles multiple middle names (picks last)', () => {
    expect(formatPublicAuthorName('Ana Maria Silva Costa')).toBe('Ana C.');
  });

  it('returns just first name if single name', () => {
    expect(formatPublicAuthorName('Rafael')).toBe('Rafael');
  });

  it('trims and handles multiple spaces', () => {
    expect(formatPublicAuthorName('  Rafael   Silva  ')).toBe('Rafael S.');
  });

  it('returns "Ẩn danh" for empty', () => {
    expect(formatPublicAuthorName('')).toBe('Ẩn danh');
    expect(formatPublicAuthorName('   ')).toBe('Ẩn danh');
  });
});
