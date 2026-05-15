import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateSettingsAuditService } from './affiliate-settings-audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AffiliateSettingsAuditService', () => {
  let service: AffiliateSettingsAuditService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      setting: { findUnique: jest.fn() },
      affiliateCommissionRuleAudit: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateSettingsAuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AffiliateSettingsAuditService);
  });

  describe('auditDefaultRateChange', () => {
    it('inserts UPDATED audit when value changed (5.00 → 10.00)', async () => {
      prisma.setting.findUnique.mockResolvedValue({ value: '5.00' });

      await service.auditDefaultRateChange('10.00', 'admin-1');

      expect(prisma.affiliateCommissionRuleAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scope: 'GLOBAL',
            action: 'UPDATED',
            changedByUserId: 'admin-1',
          }),
        }),
      );
      const call = prisma.affiliateCommissionRuleAudit.create.mock.calls[0][0];
      expect(call.data.oldRate.toString()).toBe('5');
      expect(call.data.newRate.toString()).toBe('10');
    });

    it('inserts CREATED audit when no setting existed before', async () => {
      prisma.setting.findUnique.mockResolvedValue(null);

      await service.auditDefaultRateChange('7.50', 'admin-1');

      const call = prisma.affiliateCommissionRuleAudit.create.mock.calls[0][0];
      expect(call.data.action).toBe('CREATED');
      expect(call.data.oldRate).toBeNull();
      expect(call.data.newRate.toString()).toBe('7.5');
    });

    it('does not insert audit if value did not change ("5.00" === "5.00")', async () => {
      prisma.setting.findUnique.mockResolvedValue({ value: '5.00' });

      await service.auditDefaultRateChange('5.00', 'admin-1');

      expect(prisma.affiliateCommissionRuleAudit.create).not.toHaveBeenCalled();
    });

    it('normalizes whitespace before comparing ("5.00 " === "5.00")', async () => {
      prisma.setting.findUnique.mockResolvedValue({ value: '5.00' });

      await service.auditDefaultRateChange('  5.00  ', 'admin-1');

      expect(prisma.affiliateCommissionRuleAudit.create).not.toHaveBeenCalled();
    });

    it('handles invalid value (non-numeric) without exploding — audit with newRate null', async () => {
      prisma.setting.findUnique.mockResolvedValue({ value: '5.00' });

      await service.auditDefaultRateChange('abc', 'admin-1');

      const call = prisma.affiliateCommissionRuleAudit.create.mock.calls[0][0];
      expect(call.data.newRate).toBeNull();
    });

    it('audit failure does not propagate exception (fire-and-forget)', async () => {
      prisma.setting.findUnique.mockResolvedValue({ value: '5.00' });
      prisma.affiliateCommissionRuleAudit.create.mockRejectedValue(
        new Error('db down'),
      );

      await expect(
        service.auditDefaultRateChange('10.00', 'admin-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('listDefaultRateHistory', () => {
    it('returns audits scope=GLOBAL paginated with resolved user', async () => {
      prisma.affiliateCommissionRuleAudit.findMany.mockResolvedValue([
        {
          id: 'a1',
          action: 'UPDATED',
          oldRate: '5.00',
          newRate: '10.00',
          changedByUserId: 'admin-1',
          changedAt: new Date('2026-04-24T10:00:00Z'),
        },
        {
          id: 'a2',
          action: 'UPDATED',
          oldRate: '10.00',
          newRate: '7.50',
          changedByUserId: 'admin-2',
          changedAt: new Date('2026-04-24T11:00:00Z'),
        },
      ]);
      prisma.affiliateCommissionRuleAudit.count.mockResolvedValue(2);
      prisma.user.findMany.mockResolvedValue([
        { id: 'admin-1', name: 'Rafael', email: 'rafael@x.com' },
        { id: 'admin-2', name: null, email: 'bot@x.com' },
      ]);

      const result = await service.listDefaultRateHistory({
        page: 1,
        perPage: 50,
      });

      expect(prisma.affiliateCommissionRuleAudit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { scope: 'GLOBAL' },
          orderBy: { changedAt: 'desc' },
        }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.data[0].changedBy).toEqual({
        id: 'admin-1',
        name: 'Rafael',
        email: 'rafael@x.com',
      });
      expect(result.data[1].changedBy).toEqual({
        id: 'admin-2',
        name: null,
        email: 'bot@x.com',
      });
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        perPage: 50,
        lastPage: 1,
      });
    });

    it('user deleted after audit → changedBy.email=UNKNOWN (does not break)', async () => {
      prisma.affiliateCommissionRuleAudit.findMany.mockResolvedValue([
        {
          id: 'a1',
          action: 'UPDATED',
          oldRate: '5.00',
          newRate: '10.00',
          changedByUserId: 'deleted-admin',
          changedAt: new Date('2026-04-24T10:00:00Z'),
        },
      ]);
      prisma.affiliateCommissionRuleAudit.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.listDefaultRateHistory({
        page: 1,
        perPage: 50,
      });

      expect(result.data[0].changedBy).toEqual({
        id: 'deleted-admin',
        name: null,
        email: '[deleted user]',
      });
    });

    it('pages and clamps perPage (negative → 1, >100 → 100)', async () => {
      await service.listDefaultRateHistory({ page: -5, perPage: 999 });

      const call =
        prisma.affiliateCommissionRuleAudit.findMany.mock.calls[0][0];
      expect(call.skip).toBe(0);
      expect(call.take).toBe(100);
    });

    it('defaults: page=1, perPage=50 when omitted', async () => {
      await service.listDefaultRateHistory({});

      const call =
        prisma.affiliateCommissionRuleAudit.findMany.mock.calls[0][0];
      expect(call.skip).toBe(0);
      expect(call.take).toBe(50);
    });
  });
});
