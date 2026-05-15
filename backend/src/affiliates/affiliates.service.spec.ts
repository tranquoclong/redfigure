import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AffiliatesService } from './affiliates.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../email/email-queue.service';
import { SettingsService } from '../settings/settings.service';

describe('AffiliatesService', () => {
  let service: AffiliatesService;
  let prisma: any;
  let emailQueue: any;
  let settings: any;

  beforeEach(async () => {
    prisma = {
      affiliateAccount: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    emailQueue = {
      enqueueAffiliateWelcome: jest.fn().mockResolvedValue({}),
    };
    settings = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'affiliate_enabled') return Promise.resolve('true');
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliatesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailQueueService, useValue: emailQueue },
        { provide: SettingsService, useValue: settings },
      ],
    }).compile();

    service = module.get<AffiliatesService>(AffiliatesService);
  });

  describe('apply', () => {
    const userId = 'user-1';
    const userEmail = 'user@example.com';
    const userName = 'User Name';

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: userEmail,
        name: userName,
      });
      prisma.affiliateAccount.findUnique.mockResolvedValue(null);
      prisma.affiliateAccount.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'aff-1',
          userId: data.userId,
          publicId: 42,
          status: data.status,
          termsAcceptedAt: data.termsAcceptedAt,
          termsVersion: data.termsVersion,
          approvedAt: data.approvedAt,
          createdAt: new Date(),
        }),
      );
    });

    it('creates AffiliateAccount with status=APPROVED + termsAcceptedAt when acceptedTerms=true', async () => {
      const result = await service.apply(userId, { acceptedTerms: true });

      expect(result.status).toBe('APPROVED');
      expect(prisma.affiliateAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            status: 'APPROVED',
            termsVersion: 'v1',
            termsAcceptedAt: expect.any(Date),
            approvedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('sends welcome email pos-commit', async () => {
      await service.apply(userId, { acceptedTerms: true });

      expect(emailQueue.enqueueAffiliateWelcome).toHaveBeenCalledWith({
        to: userEmail,
        name: userName,
        publicId: 42,
      });
    });

    it('rejects when acceptedTerms=false (BadRequest)', async () => {
      await expect(
        service.apply(userId, { acceptedTerms: false as unknown as true }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.affiliateAccount.create).not.toHaveBeenCalled();
    });

    it('rejects when affiliate_enabled setting is OFF (kill switch)', async () => {
      settings.get.mockImplementation((key: string) => {
        if (key === 'affiliate_enabled') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      await expect(
        service.apply(userId, { acceptedTerms: true }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.affiliateAccount.create).not.toHaveBeenCalled();
    });

    it('rejects when user already has affiliate account (Conflict)', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-existing',
        userId,
        status: 'APPROVED',
      });

      await expect(
        service.apply(userId, { acceptedTerms: true }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.affiliateAccount.create).not.toHaveBeenCalled();
    });

    it('rejects when user does not exist (NotFound)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.apply(userId, { acceptedTerms: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('email failure does not prevent affiliate creation (fire-and-forget)', async () => {
      emailQueue.enqueueAffiliateWelcome.mockRejectedValue(
        new Error('SMTP down'),
      );

      const result = await service.apply(userId, { acceptedTerms: true });
      expect(result.status).toBe('APPROVED');
    });

    it('sanitize user.name before email (strips CR/LF/angle brackets) — prevent SMTP header injection', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: userEmail,
        name: 'Evil\r\nBcc: attacker@foo.com <fake@foo>',
      });

      await service.apply(userId, { acceptedTerms: true });

      expect(emailQueue.enqueueAffiliateWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^[^\r\n<>]+$/),
        }),
      );
      const callArg = emailQueue.enqueueAffiliateWelcome.mock.calls[0][0];
      expect(callArg.name).not.toContain('\r');
      expect(callArg.name).not.toContain('\n');
      expect(callArg.name).not.toContain('<');
    });

    it('converts P2002 race condition (userId unique violation) to ConflictException', async () => {

      prisma.affiliateAccount.findUnique.mockResolvedValue(null);
      const p2002 = Object.assign(
        new Error('Unique constraint failed on the fields: (`userId`)'),
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );
      Object.setPrototypeOf(
        p2002,
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      prisma.affiliateAccount.create.mockRejectedValue(p2002);

      await expect(
        service.apply(userId, { acceptedTerms: true }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getMyAccount', () => {
    it('returns account when it exists', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        userId: 'user-1',
        publicId: 42,
        status: 'APPROVED',
      });

      const result = await service.getMyAccount('user-1');

      expect(result).toMatchObject({ id: 'aff-1', publicId: 42 });
    });

    it('returns null when it does not exist (so UI shows opt-in card)', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue(null);

      const result = await service.getMyAccount('user-1');

      expect(result).toBeNull();
    });
  });

  describe('suspend', () => {
    it('changes status to SUSPENDED + registers reason, suspendedAt and suspendedByUserId', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        status: 'APPROVED',
      });
      prisma.affiliateAccount.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'aff-1',
          status: data.status,
          suspendedAt: data.suspendedAt,
          suspendedReason: data.suspendedReason,
          suspendedByUserId: data.suspendedByUserId,
        }),
      );

      const result = await service.suspend('aff-1', {
        reason: 'Auto-compra detectada',
        suspendedByUserId: 'admin-1',
      });

      expect(result.status).toBe('SUSPENDED');
      expect(prisma.affiliateAccount.update).toHaveBeenCalledWith({
        where: { id: 'aff-1' },
        data: {
          status: 'SUSPENDED',
          suspendedAt: expect.any(Date),
          suspendedReason: 'Auto-compra detectada',
          suspendedByUserId: 'admin-1',
        },
      });
    });

    it('rejects if affiliate does not exist', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue(null);

      await expect(
        service.suspend('aff-x', {
          reason: 'r',
          suspendedByUserId: 'admin-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects if reason is empty (anti-fraud: audit trail required)', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        status: 'APPROVED',
      });

      await expect(
        service.suspend('aff-1', {
          reason: '   ',
          suspendedByUserId: 'admin-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects huge reason (> 1000 chars) — prevents payload DoS', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        status: 'APPROVED',
      });
      const huge = 'x'.repeat(1001);

      await expect(
        service.suspend('aff-1', {
          reason: huge,
          suspendedByUserId: 'admin-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('is idempotent if already SUSPENDED — does not overwrite audit trail', async () => {

      const original = {
        id: 'aff-1',
        status: 'SUSPENDED',
        suspendedAt: new Date('2026-01-01'),
        suspendedReason: 'Original reason',
        suspendedByUserId: 'admin-A',
      };
      prisma.affiliateAccount.findUnique.mockResolvedValue(original);

      const result = await service.suspend('aff-1', {
        reason: 'New reason trying to overwrite',
        suspendedByUserId: 'admin-B',
      });

      expect(result).toBe(original);
      expect(prisma.affiliateAccount.update).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('restores status=APPROVED + cleans suspension fields', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        status: 'SUSPENDED',
      });
      prisma.affiliateAccount.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'aff-1',
          status: data.status,
          suspendedAt: data.suspendedAt,
          suspendedReason: data.suspendedReason,
          suspendedByUserId: data.suspendedByUserId,
        }),
      );

      const result = await service.reactivate('aff-1');

      expect(result.status).toBe('APPROVED');
      expect(prisma.affiliateAccount.update).toHaveBeenCalledWith({
        where: { id: 'aff-1' },
        data: {
          status: 'APPROVED',
          suspendedAt: null,
          suspendedReason: null,
          suspendedByUserId: null,
        },
      });
    });

    it('is no-op if affiliate is already APPROVED', async () => {
      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        status: 'APPROVED',
      });

      const result = await service.reactivate('aff-1');

      expect(result.status).toBe('APPROVED');
      expect(prisma.affiliateAccount.update).not.toHaveBeenCalled();
    });

    it('rejects reactivation if status is not SUSPENDED or APPROVED (state machine)', async () => {

      prisma.affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        status: 'REJECTED',
      });

      await expect(service.reactivate('aff-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
