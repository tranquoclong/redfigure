import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AffiliateCommissionRulesService } from './affiliate-commission-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { describe, it } from 'node:test';

describe('AffiliateCommissionRulesService', () => {
  let service: AffiliateCommissionRulesService;
  let prisma: any;
  let settings: any;

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn() },
      affiliateCommissionRule: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      affiliateCommissionRuleAudit: {
        create: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    settings = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'affiliate_default_commission_rate')
          return Promise.resolve('5.00');
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateCommissionRulesService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
      ],
    }).compile();

    service = module.get<AffiliateCommissionRulesService>(
      AffiliateCommissionRulesService,
    );
  });

  describe('resolveRate — product > tag > category > global', () => {
    const productId = 'prod-1';
    const tagA = 'tag-a';
    const tagB = 'tag-b';
    const catX = 'cat-x';
    const catY = 'cat-y';

    function mockProduct(tags: string[], categories: string[]) {
      prisma.product.findUnique.mockResolvedValue({
        id: productId,
        tags: tags.map((id) => ({ id })),
        productCategories: categories.map((categoryId) => ({ categoryId })),
      });
    }

    it('(1) product without rule + no tags/cats → uses global default', async () => {
      mockProduct([], []);
      prisma.affiliateCommissionRule.findFirst.mockResolvedValue(null);
      prisma.affiliateCommissionRule.findMany.mockResolvedValue([]);

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(5);
    });

    it('(2) product with rule > 0 → uses it (ignores tag/cat/global)', async () => {
      mockProduct([tagA], [catX]);
      prisma.affiliateCommissionRule.findFirst.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'PRODUCT')
            return Promise.resolve({ rate: '10.00' });
          return Promise.resolve(null);
        },
      );
      prisma.affiliateCommissionRule.findMany.mockResolvedValue([
        { rate: '99.00' },
      ]);

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(10);
    });

    it('(3) product with rule 0 → explicit veto, return 0 (no cascade)', async () => {
      mockProduct([tagA], [catX]);
      prisma.affiliateCommissionRule.findFirst.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'PRODUCT')
            return Promise.resolve({ rate: '0.00' });
          return Promise.resolve(null);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(0);
    });

    it('(4) no product rule, 1 tag with rule → uses tag', async () => {
      mockProduct([tagA], []);
      prisma.affiliateCommissionRule.findFirst.mockResolvedValue(null);
      prisma.affiliateCommissionRule.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'TAG') return Promise.resolve([{ rate: '7.00' }]);
          return Promise.resolve([]);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(7);
    });

    it('(5) multiple tags with rules [3, 8] → HIGHEST wins (8)', async () => {
      mockProduct([tagA, tagB], []);
      prisma.affiliateCommissionRule.findFirst.mockResolvedValue(null);
      prisma.affiliateCommissionRule.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'TAG')
            return Promise.resolve([{ rate: '3.00' }, { rate: '8.00' }]);
          return Promise.resolve([]);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(8);
    });

    it('(6) multiple tags with rules [0, 8] → ZERO VETO (returns 0)', async () => {
      mockProduct([tagA, tagB], []);
      prisma.affiliateCommissionRule.findFirst.mockResolvedValue(null);
      prisma.affiliateCommissionRule.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'TAG')
            return Promise.resolve([{ rate: '0.00' }, { rate: '8.00' }]);
          return Promise.resolve([]);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(0);
    });

    it('(7) tag sem rule + categoria com rule → uses category', async () => {
      mockProduct([tagA], [catX]);
      prisma.affiliateCommissionRule.findFirst.mockResolvedValue(null);
      prisma.affiliateCommissionRule.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'TAG') return Promise.resolve([]);
          if (where.scope === 'CATEGORY')
            return Promise.resolve([{ rate: '4.00' }]);
          return Promise.resolve([]);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(4);
    });

    it('(8) tag rule + cat rule → TAG wins (cascade stops at tag)', async () => {
      mockProduct([tagA], [catX]);
      prisma.affiliateCommissionRule.findFirst.mockResolvedValue(null);
      prisma.affiliateCommissionRule.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'TAG') return Promise.resolve([{ rate: '9.00' }]);
          if (where.scope === 'CATEGORY')
            return Promise.resolve([{ rate: '5.00' }]);
          return Promise.resolve([]);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(9);
    });

    it('(9) tag rule 0 VETO even if category/global > 0', async () => {
      mockProduct([tagA], [catX]);
      prisma.affiliateCommissionRule.findFirst.mockResolvedValue(null);
      prisma.affiliateCommissionRule.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'TAG') return Promise.resolve([{ rate: '0.00' }]);
          if (where.scope === 'CATEGORY')
            return Promise.resolve([{ rate: '10.00' }]);
          return Promise.resolve([]);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(0);
    });

    it('(10) multiple categories with [6, 12] → highest (12)', async () => {
      mockProduct([], [catX, catY]);
      prisma.affiliateCommissionRule.findFirst.mockResolvedValue(null);
      prisma.affiliateCommissionRule.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'TAG') return Promise.resolve([]);
          if (where.scope === 'CATEGORY')
            return Promise.resolve([{ rate: '6.00' }, { rate: '12.00' }]);
          return Promise.resolve([]);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(12);
    });

    it('(11) product does not exist → returns default (service resilient)', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(5);
    });

    it('(12) Decimal string "7.50" becomes 7.5 numeric', async () => {
      mockProduct([], []);
      prisma.affiliateCommissionRule.findFirst.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'PRODUCT')
            return Promise.resolve({ rate: '7.50' });
          return Promise.resolve(null);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(7.5);
    });

    it('(13) default setting missing → hardcoded fallback 5%', async () => {
      mockProduct([], []);
      prisma.affiliateCommissionRule.findFirst.mockResolvedValue(null);
      prisma.affiliateCommissionRule.findMany.mockResolvedValue([]);
      settings.get.mockResolvedValue(null);

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(5);
    });

    it('(14) product rule 0 + tag rule 100 → product VETO (for ali)', async () => {
      mockProduct([tagA], []);
      prisma.affiliateCommissionRule.findFirst.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'PRODUCT')
            return Promise.resolve({ rate: '0.00' });
          return Promise.resolve(null);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(rate).toBe(0);

      expect(prisma.affiliateCommissionRule.findMany).not.toHaveBeenCalled();
    });

    it('(15) return always number (never Decimal object) - pricing integration', async () => {
      mockProduct([], []);
      prisma.affiliateCommissionRule.findFirst.mockImplementation(
        ({ where }: any) => {
          if (where.scope === 'PRODUCT')
            return Promise.resolve({ rate: '5.00' });
          return Promise.resolve(null);
        },
      );

      const rate = await service.resolveRate(productId);
      expect(typeof rate).toBe('number');
    });
  });

  describe('createRule — creates rule + atomic audit log', () => {
    it('creates PRODUCT rule + audit entry with action CREATED', async () => {
      prisma.affiliateCommissionRule.create.mockResolvedValue({
        id: 'rule-1',
        scope: 'PRODUCT',
        productId: 'prod-1',
        tagId: null,
        categoryId: null,
        rate: '7.50',
      });
      prisma.affiliateCommissionRuleAudit.create.mockResolvedValue({});

      const result = await service.createRule(
        { scope: 'PRODUCT', productId: 'prod-1', rate: 7.5 },
        'admin-1',
      );

      expect(result.id).toBe('rule-1');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.affiliateCommissionRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scope: 'PRODUCT',
          productId: 'prod-1',
          rate: 7.5,
        }),
      });
      expect(prisma.affiliateCommissionRuleAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ruleId: 'rule-1',
          scope: 'PRODUCT',
          action: 'CREATED',
          newRate: '7.50',
          productId: 'prod-1',
          changedByUserId: 'admin-1',
        }),
      });
    });

    it('rejects scope + target mismatch (scope PRODUCT with tagId set)', async () => {
      await expect(
        service.createRule(
          {
            scope: 'PRODUCT',
            productId: 'prod-1',
            tagId: 'tag-1',
            rate: 5,
          } as any,
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.affiliateCommissionRule.create).not.toHaveBeenCalled();
    });

    it('rejects rate outside 0-100', async () => {
      await expect(
        service.createRule(
          { scope: 'PRODUCT', productId: 'prod-1', rate: 150 },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('converts P2002 (rule already exists for this target) into Conflict', async () => {
      const p2002 = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        clientVersion: 'test',
      });
      Object.setPrototypeOf(
        p2002,
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      prisma.affiliateCommissionRule.create.mockRejectedValue(p2002);

      await expect(
        service.createRule(
          { scope: 'PRODUCT', productId: 'prod-1', rate: 5 },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateRule — updates rate + audit with old/new', () => {
    it('updates rate + creates audit with oldRate and newRate', async () => {
      prisma.affiliateCommissionRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        scope: 'TAG',
        tagId: 'tag-1',
        productId: null,
        categoryId: null,
        rate: '5.00',
      });
      prisma.affiliateCommissionRule.update.mockResolvedValue({
        id: 'rule-1',
        scope: 'TAG',
        tagId: 'tag-1',
        rate: '8.50',
      });

      const result = await service.updateRule('rule-1', 8.5, 'admin-1');

      expect(result.rate).toBe('8.50');
      expect(prisma.affiliateCommissionRuleAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ruleId: 'rule-1',
          scope: 'TAG',
          action: 'UPDATED',
          oldRate: '5.00',
          newRate: '8.50',
          tagId: 'tag-1',
          changedByUserId: 'admin-1',
        }),
      });
    });

    it('rejects if rule does not exist', async () => {
      prisma.affiliateCommissionRule.findUnique.mockResolvedValue(null);
      await expect(service.updateRule('rule-x', 5, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects rate outside 0-100', async () => {
      prisma.affiliateCommissionRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        scope: 'PRODUCT',
        productId: 'p1',
        rate: '5.00',
      });
      await expect(service.updateRule('rule-1', -5, 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('no-op if new rate == current rate (does not register audit)', async () => {
      prisma.affiliateCommissionRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        scope: 'PRODUCT',
        productId: 'p1',
        rate: '5.00',
      });

      await service.updateRule('rule-1', 5, 'admin-1');

      expect(prisma.affiliateCommissionRule.update).not.toHaveBeenCalled();
      expect(prisma.affiliateCommissionRuleAudit.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteRule — delete + audit with oldRate snapshot', () => {
    it('deletes rule + creates audit with action DELETED with snapshot', async () => {
      prisma.affiliateCommissionRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        scope: 'CATEGORY',
        categoryId: 'cat-1',
        productId: null,
        tagId: null,
        rate: '10.00',
      });
      prisma.affiliateCommissionRule.delete.mockResolvedValue({});

      await service.deleteRule('rule-1', 'admin-1');

      expect(prisma.affiliateCommissionRuleAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ruleId: 'rule-1',
          scope: 'CATEGORY',
          action: 'DELETED',
          oldRate: '10.00',
          categoryId: 'cat-1',
          changedByUserId: 'admin-1',
        }),
      });
      expect(prisma.affiliateCommissionRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
    });

    it('rejects if rule does not exist', async () => {
      prisma.affiliateCommissionRule.findUnique.mockResolvedValue(null);
      await expect(service.deleteRule('rule-x', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
