import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReviewInvitesService } from './review-invites.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CouponsService } from '../coupons/coupons.service';
import { EmailQueueService } from '../email/email-queue.service';

const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
const mockJobRemove = jest.fn().mockResolvedValue(undefined);
const mockGetJob = jest
  .fn()
  .mockResolvedValue({ id: 'job-1', remove: mockJobRemove });
const mockQueueClose = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
    getJob: mockGetJob,
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

describe('ReviewInvitesService', () => {
  let service: ReviewInvitesService;
  let prisma: any;
  let settings: any;
  let coupons: any;
  let emailQueue: any;

  const defaultSettings = {
    enabled: true,
    firstEmailDays: 2,
    reminderDays: 2,
    couponType: 'PERCENTAGE' as const,
    couponValue: 10,
    couponValidityDays: 30,
    couponMinOrder: 0,
    maxPhotos: 5,
    maxPhotoSizeMb: 5,
    inviteValidityDays: 30,
  };

  beforeEach(async () => {
    mockQueueAdd.mockClear();
    mockJobRemove.mockClear();
    mockGetJob.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewInvitesService,
        {
          provide: PrismaService,
          useValue: {
            order: { findUnique: jest.fn() },
            reviewInvite: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            siteReview: { create: jest.fn() },
            review: { create: jest.fn() },
            $transaction: jest.fn(async (fn) => {
              const tx = {
                reviewInvite: {
                  update: jest.fn().mockResolvedValue({ id: 'inv1' }),
                },
                siteReview: { create: jest.fn().mockResolvedValue({}) },
                review: { create: jest.fn().mockResolvedValue({}) },
              };
              return typeof fn === 'function' ? fn(tx) : Promise.all(fn);
            }),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getReviewSettings: jest.fn().mockResolvedValue(defaultSettings),
          },
        },
        {
          provide: CouponsService,
          useValue: {
            createReviewReward: jest.fn(),
          },
        },
        {
          provide: EmailQueueService,
          useValue: {
            enqueueReviewReward: jest.fn(),
          },
        },
        {
          provide: 'REDIS_CONNECTION',
          useValue: { host: 'localhost', port: 6379 },
        },
      ],
    }).compile();

    service = module.get(ReviewInvitesService);
    prisma = module.get(PrismaService);
    settings = module.get(SettingsService);
    coupons = module.get(CouponsService);
    emailQueue = module.get(EmailQueueService);
  });

  describe('createForOrder', () => {
    it('creates invite with hex token + schedules 2 jobs (request and reminder)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'user1',
      });
      prisma.reviewInvite.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'inv1', ...data }),
      );

      const result = await service.createForOrder('order1');

      expect(result).toBeTruthy();
      const createCall = prisma.reviewInvite.create.mock.calls[0][0];
      expect(createCall.data.orderId).toBe('order1');
      expect(createCall.data.userId).toBe('user1');
      expect(createCall.data.token).toMatch(/^[a-f0-9]{64}$/);

      expect(mockQueueAdd).toHaveBeenCalledTimes(2);
      const [requestCall, reminderCall] = mockQueueAdd.mock.calls;
      expect(requestCall[0]).toBe('review-request');
      expect(requestCall[2].jobId).toBe('review-request-order1');
      expect(requestCall[2].delay).toBe(2 * 86400000);
      expect(reminderCall[0]).toBe('review-reminder');
      expect(reminderCall[2].jobId).toBe('review-reminder-order1');
      expect(reminderCall[2].delay).toBe((2 + 2) * 86400000);
    });

    it('returns null and does not schedule when review_enabled=false', async () => {
      settings.getReviewSettings.mockResolvedValue({
        ...defaultSettings,
        enabled: false,
      });

      const result = await service.createForOrder('order1');

      expect(result).toBeNull();
      expect(prisma.reviewInvite.create).not.toHaveBeenCalled();
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.createForOrder('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('is idempotent: if invite already exists, returns the existing one without recreating', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'user1',
        reviewInvite: { id: 'existing-invite', token: 'abc' },
      });

      const result = await service.createForOrder('order1');

      expect(result?.id).toBe('existing-invite');
      expect(prisma.reviewInvite.create).not.toHaveBeenCalled();
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe('findByToken', () => {
    it('returns invite + order + items when token is valid and active', async () => {
      const invite = {
        id: 'inv1',
        token: 't1',
        tokenExpiresAt: new Date(Date.now() + 86400000),
        submittedAt: null,
        order: { id: 'order1', items: [] },
        user: { id: 'user1', name: 'John' },
      };
      prisma.reviewInvite.findUnique.mockResolvedValue(invite);

      const result = await service.findByToken('t1');

      expect(result.invite.id).toBe('inv1');
      expect(result.order.id).toBe('order1');
    });

    it('throws NotFound when token does not exist', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(null);
      await expect(service.findByToken('bogus')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequest when invite is expired', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue({
        id: 'inv1',
        tokenExpiresAt: new Date(Date.now() - 86400000),
        submittedAt: null,
      });

      await expect(service.findByToken('t1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequest when invite has already been submitted', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue({
        id: 'inv1',
        tokenExpiresAt: new Date(Date.now() + 86400000),
        submittedAt: new Date(),
      });

      await expect(service.findByToken('t1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('submit', () => {
    const validInvite = () => ({
      id: 'inv1',
      orderId: 'order1',
      userId: 'user1',
      token: 't1',
      tokenExpiresAt: new Date(Date.now() + 86400000),
      submittedAt: null,
      order: {
        id: 'order1',
        customerEmail: 'client@test.com',
        customerName: 'John',
        items: [
          { productId: 'p1', product: { name: 'Elf' } },
          { productId: 'p2', product: { name: 'Orc' } },
        ],
      },
      user: { id: 'user1', email: 'client@test.com', name: 'John' },
    });

    const payload = {
      site: { rating: 5, comment: 'Great!' },
      products: [
        { productId: 'p1', rating: 5, comment: 'Beautiful' },
        { productId: 'p2', rating: 4 },
      ],
      displayName: 'John S.',
    };

    it('creates SiteReview + Reviews + coupon, marks submittedAt and enqueues email', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(validInvite());
      coupons.createReviewReward.mockResolvedValue({
        id: 'coup1',
        code: 'REVIEW-ABC12345',
      });

      const txCalls: any = {
        reviewInvite: {
          findUnique: jest.fn().mockResolvedValue({ submittedAt: null }),
          update: jest.fn().mockResolvedValue({ id: 'inv1' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        siteReview: { create: jest.fn().mockResolvedValue({ id: 'sr1' }) },
        review: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) =>
        typeof fn === 'function' ? fn(txCalls) : Promise.all(fn),
      );

      await service.submit('t1', payload);

      expect(txCalls.siteReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order1',
          userId: 'user1',
          rating: 5,
          comment: 'Great!',
          displayName: 'John S.',
        }),
      });

      expect(txCalls.review.create).toHaveBeenCalledTimes(2);

      expect(coupons.createReviewReward).toHaveBeenCalledWith(
        'user1',
        expect.any(Object),
      );

      expect(txCalls.reviewInvite.updateMany).toHaveBeenCalledWith({
        where: { id: 'inv1', submittedAt: null },
        data: expect.objectContaining({
          submittedAt: expect.any(Date),
          couponId: 'coup1',
        }),
      });

      expect(emailQueue.enqueueReviewReward).toHaveBeenCalled();

      expect(mockGetJob).toHaveBeenCalledWith('review-reminder-order1');
      expect(mockJobRemove).toHaveBeenCalled();
    });

    it('rejects products that are not in the order (avoids spam)', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(validInvite());

      await expect(
        service.submit('t1', {
          site: { rating: 5 },
          products: [{ productId: 'product-not-in-order', rating: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when invite is expired', async () => {
      const inv = validInvite();
      inv.tokenExpiresAt = new Date(Date.now() - 86400000);
      prisma.reviewInvite.findUnique.mockResolvedValue(inv);

      await expect(service.submit('t1', payload)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects double-submit (non-null submittedAt)', async () => {
      const inv = validInvite();
      inv.submittedAt = new Date();
      prisma.reviewInvite.findUnique.mockResolvedValue(inv);

      await expect(service.submit('t1', payload)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
