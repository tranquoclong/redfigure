import { Test, TestingModule } from '@nestjs/testing';
import { ReviewInvitesProcessor } from './review-invites.processor';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EmailQueueService } from '../email/email-queue.service';
import { UnsubscribeService } from '../users/unsubscribe.service';
import { ConfigService } from '@nestjs/config';

describe('ReviewInvitesProcessor', () => {
  let processor: ReviewInvitesProcessor;
  let prisma: {
    reviewInvite: { findUnique: jest.Mock; update: jest.Mock };
  };
  let emailQueue: {
    enqueueReviewRequest: jest.Mock;
    enqueueReviewReminder: jest.Mock;
  };
  let unsubscribe: {
    generateToken: jest.Mock;
    buildUrl: jest.Mock;
    buildOneClickUrl: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      reviewInvite: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    emailQueue = {
      enqueueReviewRequest: jest.fn().mockResolvedValue(undefined),
      enqueueReviewReminder: jest.fn().mockResolvedValue(undefined),
    };
    unsubscribe = {
      generateToken: jest.fn().mockResolvedValue('jwt-token-xyz'),
      buildUrl: jest
        .fn()
        .mockResolvedValue(
          'https://redfigure.com/unsubscribe?t=jwt-token-xyz',
        ),
      buildOneClickUrl: jest
        .fn()
        .mockResolvedValue(
          'https://api.redfigure.com/api/v1/users/unsubscribe/one-click?t=jwt-token-xyz',
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewInvitesProcessor,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SettingsService,
          useValue: {
            getReviewSettings: jest.fn().mockResolvedValue({
              couponType: 'PERCENTAGE',
              couponValue: 5,
              couponValidityDays: 30,
            }),
          },
        },
        { provide: EmailQueueService, useValue: emailQueue },
        { provide: UnsubscribeService, useValue: unsubscribe },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('https://redfigure.com'),
          },
        },
      ],
    }).compile();

    processor = module.get<ReviewInvitesProcessor>(ReviewInvitesProcessor);
  });

  const makeInvite = (overrides = {}) => ({
    id: 'invite-1',
    token: 'tok-abc',
    submittedAt: null,
    tokenExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    order: {
      id: 'order-1',
      customerEmail: 'buyer@test.com',
      customerName: 'Buyer',
      items: [],
    },
    user: {
      id: 'user-1',
      email: 'buyer@test.com',
      name: 'Buyer',
      emailMarketingOptOut: false,
    },
    ...overrides,
  });

  describe('opt-out gate', () => {
    it('client with emailMarketingOptOut=true does NOT trigger review-request', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(
        makeInvite({
          user: {
            id: 'user-1',
            email: 'buyer@test.com',
            name: 'Buyer',
            emailMarketingOptOut: true,
          },
        }),
      );

      await processor.handle('review-request', { inviteId: 'invite-1' });

      expect(emailQueue.enqueueReviewRequest).not.toHaveBeenCalled();
    });

    it('client with emailMarketingOptOut=true does NOT trigger review-reminder', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(
        makeInvite({
          user: {
            id: 'user-1',
            email: 'buyer@test.com',
            name: 'Buyer',
            emailMarketingOptOut: true,
          },
        }),
      );

      await processor.handle('review-reminder', { inviteId: 'invite-1' });

      expect(emailQueue.enqueueReviewReminder).not.toHaveBeenCalled();
    });

    it('client WITHOUT opt-out triggers normally (request)', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(makeInvite());

      await processor.handle('review-request', { inviteId: 'invite-1' });

      expect(emailQueue.enqueueReviewRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe URL injection', () => {
    it('review-request payload includes unsubscribeUrl with generated JWT', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(makeInvite());

      await processor.handle('review-request', { inviteId: 'invite-1' });

      expect(unsubscribe.buildUrl).toHaveBeenCalledWith('user-1');
      expect(emailQueue.enqueueReviewRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          unsubscribeUrl: 'https://redfigure.com/unsubscribe?t=jwt-token-xyz',
        }),
      );
    });

    it('review-reminder payload includes unsubscribeUrl', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(makeInvite());

      await processor.handle('review-reminder', { inviteId: 'invite-1' });

      expect(emailQueue.enqueueReviewReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          unsubscribeUrl: expect.stringContaining('/unsubscribe?t='),
        }),
      );
    });
  });

  describe('existing guards (should not break)', () => {
    it('already submitted invite does NOT trigger', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(
        makeInvite({ submittedAt: new Date() }),
      );
      await processor.handle('review-request', { inviteId: 'invite-1' });
      expect(emailQueue.enqueueReviewRequest).not.toHaveBeenCalled();
    });

    it('expired invite does NOT trigger', async () => {
      prisma.reviewInvite.findUnique.mockResolvedValue(
        makeInvite({ tokenExpiresAt: new Date(Date.now() - 1000) }),
      );
      await processor.handle('review-request', { inviteId: 'invite-1' });
      expect(emailQueue.enqueueReviewRequest).not.toHaveBeenCalled();
    });
  });
});
