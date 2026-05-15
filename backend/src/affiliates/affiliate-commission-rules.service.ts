import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, CommissionRuleScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const DEFAULT_RATE_FALLBACK = 5;

export interface CreateCommissionRuleInput {
  scope: CommissionRuleScope;
  rate: number;
  productId?: string;
  tagId?: string;
  categoryId?: string;
}

@Injectable()
export class AffiliateCommissionRulesService {
  private readonly logger = new Logger(AffiliateCommissionRulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) { }

  async resolveRate(productId: string): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        tags: { select: { id: true } },
        productCategories: { select: { categoryId: true } },
      },
    });

    if (!product) {
      return this.getDefaultRate();
    }

    const productRule = await this.prisma.affiliateCommissionRule.findFirst({
      where: { scope: 'PRODUCT', productId },
      select: { rate: true },
    });
    if (productRule) {
      return Number(productRule.rate);
    }

    const tagIds = product.tags.map((t) => t.id);
    if (tagIds.length > 0) {
      const tagRules = await this.prisma.affiliateCommissionRule.findMany({
        where: { scope: 'TAG', tagId: { in: tagIds } },
        select: { rate: true },
      });
      if (tagRules.length > 0) {
        return this.resolveFromMultipleRules(tagRules);
      }
    }

    const categoryIds = product.productCategories.map((pc) => pc.categoryId);
    if (categoryIds.length > 0) {
      const catRules = await this.prisma.affiliateCommissionRule.findMany({
        where: { scope: 'CATEGORY', categoryId: { in: categoryIds } },
        select: { rate: true },
      });
      if (catRules.length > 0) {
        return this.resolveFromMultipleRules(catRules);
      }
    }

    return this.getDefaultRate();
  }

  private resolveFromMultipleRules(
    rules: Array<{ rate: Prisma.Decimal | string | number }>,
  ): number {
    const rates = rules.map((r) => Number(r.rate));
    if (rates.some((r) => r === 0)) return 0;
    return Math.max(...rates);
  }

  private async getDefaultRate(): Promise<number> {
    const val = await this.settings.get('affiliate_default_commission_rate');
    if (!val) return DEFAULT_RATE_FALLBACK;
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : DEFAULT_RATE_FALLBACK;
  }

  async createRule(dto: CreateCommissionRuleInput, adminUserId: string) {
    this.validateRuleShape(dto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const rule = await tx.affiliateCommissionRule.create({
          data: {
            scope: dto.scope,
            rate: dto.rate,
            productId: dto.productId ?? null,
            tagId: dto.tagId ?? null,
            categoryId: dto.categoryId ?? null,
          },
        });
        await tx.affiliateCommissionRuleAudit.create({
          data: {
            ruleId: rule.id,
            scope: rule.scope,
            action: 'CREATED',
            newRate: rule.rate,
            productId: rule.productId,
            tagId: rule.tagId,
            categoryId: rule.categoryId,
            changedByUserId: adminUserId,
          },
        });
        return rule;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Rule already exists for this target',
        );
      }
      throw err;
    }
  }

  async updateRule(ruleId: string, newRate: number, adminUserId: string) {
    if (newRate < 0 || newRate > 100) {
      throw new BadRequestException('Rate outside the 0-100 range');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.affiliateCommissionRule.findUnique({
        where: { id: ruleId },
      });
      if (!existing) {
        throw new NotFoundException('Rule not found');
      }

      const existingRate =
        existing.rate instanceof Prisma.Decimal
          ? existing.rate
          : new Prisma.Decimal(existing.rate as unknown as number | string);
      if (existingRate.equals(newRate)) {
        return existing;
      }

      const updated = await tx.affiliateCommissionRule.update({
        where: { id: ruleId },
        data: { rate: newRate },
      });

      await tx.affiliateCommissionRuleAudit.create({
        data: {
          ruleId,
          scope: existing.scope,
          action: 'UPDATED',
          oldRate: existing.rate,
          newRate: updated.rate,
          productId: existing.productId,
          tagId: existing.tagId,
          categoryId: existing.categoryId,
          changedByUserId: adminUserId,
        },
      });

      return updated;
    });
  }

  async deleteRule(ruleId: string, adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.affiliateCommissionRule.findUnique({
        where: { id: ruleId },
      });
      if (!existing) {
        throw new NotFoundException('Rule not found');
      }

      await tx.affiliateCommissionRuleAudit.create({
        data: {
          ruleId,
          scope: existing.scope,
          action: 'DELETED',
          oldRate: existing.rate,
          productId: existing.productId,
          tagId: existing.tagId,
          categoryId: existing.categoryId,
          changedByUserId: adminUserId,
        },
      });

      await tx.affiliateCommissionRule.delete({ where: { id: ruleId } });
    });
  }

  async listRules(opts: {
    scope?: CommissionRuleScope;
    page?: number;
    perPage?: number;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.max(1, Math.min(opts.perPage ?? 50, 100));
    const where: Prisma.AffiliateCommissionRuleWhereInput = {};
    if (opts.scope) where.scope = opts.scope;

    const [data, total] = await Promise.all([
      this.prisma.affiliateCommissionRule.findMany({
        where,
        orderBy: [{ scope: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          tag: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.affiliateCommissionRule.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }

  private validateRuleShape(dto: CreateCommissionRuleInput) {
    if (dto.rate < 0 || dto.rate > 100) {
      throw new BadRequestException('rate outside the 0-100 range');
    }

    const hasProduct = !!dto.productId;
    const hasTag = !!dto.tagId;
    const hasCategory = !!dto.categoryId;
    const countOfTargets = [hasProduct, hasTag, hasCategory].filter(
      Boolean,
    ).length;

    if (countOfTargets !== 1) {
      throw new BadRequestException(
        'Exactly one of {productId, tagId, categoryId} must be set',
      );
    }

    if (dto.scope === 'PRODUCT' && !hasProduct) {
      throw new BadRequestException('scope=PRODUCT requires productId');
    }
    if (dto.scope === 'TAG' && !hasTag) {
      throw new BadRequestException('scope=TAG requires tagId');
    }
    if (dto.scope === 'CATEGORY' && !hasCategory) {
      throw new BadRequestException('scope=CATEGORY requires categoryId');
    }
  }
}
