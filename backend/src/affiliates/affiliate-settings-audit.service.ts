import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AffiliateSettingsAuditService {
  private readonly logger = new Logger(AffiliateSettingsAuditService.name);

  constructor(private readonly prisma: PrismaService) { }

  async auditDefaultRateChange(
    newRaw: string,
    changedByUserId: string,
  ): Promise<void> {
    try {
      const key = 'affiliate_default_commission_rate';
      const old = await this.prisma.setting.findUnique({ where: { key } });

      const normalizedNew = String(newRaw).trim();
      const normalizedOld = old ? String(old.value).trim() : null;

      if (normalizedOld !== null && normalizedOld === normalizedNew) {
        return;
      }

      const parseRate = (v: string | null): Prisma.Decimal | null => {
        if (v == null) return null;
        const n = Number(v);
        if (!Number.isFinite(n)) return null;
        return new Prisma.Decimal(n);
      };

      await this.prisma.affiliateCommissionRuleAudit.create({
        data: {
          ruleId: null,
          scope: 'GLOBAL',
          action: normalizedOld === null ? 'CREATED' : 'UPDATED',
          oldRate: parseRate(normalizedOld),
          newRate: parseRate(normalizedNew),
          changedByUserId,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to write audit for default_rate change: ${msg}`,
      );
    }
  }

  async listDefaultRateHistory(opts: { page?: number; perPage?: number }) {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.max(1, Math.min(opts.perPage ?? 50, 100));

    const [audits, total] = await Promise.all([
      this.prisma.affiliateCommissionRuleAudit.findMany({
        where: { scope: 'GLOBAL' },
        orderBy: { changedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.affiliateCommissionRuleAudit.count({
        where: { scope: 'GLOBAL' },
      }),
    ]);

    const userIds = Array.from(
      new Set(audits.map((a) => a.changedByUserId).filter(Boolean)),
    );
    const users = userIds.length
      ? await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = audits.map((a) => {
      const user = userMap.get(a.changedByUserId);
      return {
        id: a.id,
        action: a.action,
        oldRate: a.oldRate?.toString() ?? null,
        newRate: a.newRate?.toString() ?? null,
        changedAt: a.changedAt,
        changedBy: user
          ? { id: user.id, name: user.name, email: user.email }
          : {
            id: a.changedByUserId,
            name: null,
            email: '[deleted user]',
          },
      };
    });

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
}
