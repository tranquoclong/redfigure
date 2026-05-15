import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateLedgerService } from './affiliate-ledger.service';

const MAX_RANGE_DAYS = 366;

export type Granularity = 'day' | 'week' | 'month';

export interface DashboardFilter {
  dateFrom: Date;
  dateTo: Date;
  affiliateId?: string;
}

export interface DashboardStats {
  totalCommissions: number;
  paidCommissions: number;
  cancelledCommissions: number;
  totalAffiliateEarnings: number;
  totalVisits: number;
  totalConversions: number;
  conversionRate: number;
  avgConversionTimeHours: number;
}

export interface TimeSeriesPoint {
  date: Date;
  total: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalCommissions: number;
  totalOrders: number;
}

export interface TopAffiliate {
  affiliateId: string;
  publicId: number;
  name: string | null;
  email: string;
  totalCommissions: number;
  totalOrders: number;
}

export interface AffiliateOverview {
  currentBalance: number;
  pendingCommissions: number;
  approvedCommissions: number;
  cancelledCommissions: number;
  paidLifetime: number;
  visits30d: number;
  conversions30d: number;
}

@Injectable()
export class AffiliateStatsService {
  private readonly logger = new Logger(AffiliateStatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: AffiliateLedgerService,
  ) {}

  async getDashboardStats(filter: DashboardFilter): Promise<DashboardStats> {
    this.assertRangeValid(filter.dateFrom, filter.dateTo);
    const { dateFrom, dateTo, affiliateId } = filter;

    const commissionWhereBase = {
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(affiliateId ? { affiliateId } : {}),
    };

    const [
      totalRes,
      paidRes,
      cancelledRes,
      earningsRes,
      visits,
      conversions,
      avgTimeRes,
    ] = await Promise.all([
      this.prisma.affiliateCommission.aggregate({
        _sum: { commissionAmount: true },
        where: {
          ...commissionWhereBase,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      }),
      this.prisma.affiliateLedgerEntry.aggregate({
        _sum: { amount: true },
        where: {
          type: 'DEBIT',
          source: 'PAYMENT',
          createdAt: { gte: dateFrom, lte: dateTo },
          ...(affiliateId ? { affiliateId } : {}),
        },
      }),
      this.prisma.affiliateCommission.aggregate({
        _sum: { commissionAmount: true },
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: 'CANCELLED',
          ...(affiliateId ? { affiliateId } : {}),
        },
      }),

      this.prisma.order.aggregate({
        _sum: { subtotal: true },
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          referringAffiliateId: affiliateId ?? { not: null },
        },
      }),
      this.prisma.affiliateVisit.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          ...(affiliateId ? { affiliateId } : {}),
        },
      }),
      this.prisma.order.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          referringAffiliateId: affiliateId ?? { not: null },
        },
      }),
      this.getAvgConversionTime({ dateFrom, dateTo, affiliateId }),
    ]);

    const totalVisits = visits;
    const totalConversions = conversions;
    const conversionRate =
      totalVisits > 0 ? (totalConversions / totalVisits) * 100 : 0;

    return {
      totalCommissions: toNum(totalRes._sum.commissionAmount),
      paidCommissions: toNum(paidRes._sum.amount),
      cancelledCommissions: toNum(cancelledRes._sum.commissionAmount),
      totalAffiliateEarnings: toNum(earningsRes._sum.subtotal),
      totalVisits,
      totalConversions,
      conversionRate: roundTo2(conversionRate),
      avgConversionTimeHours: avgTimeRes,
    };
  }

  private async getAvgConversionTime(filter: DashboardFilter): Promise<number> {

    const affiliateFilter = filter.affiliateId
      ? Prisma.sql`AND v."affiliateId" = ${filter.affiliateId}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ avg_hours: string | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (v."convertedAt" - first_visit.min_at)) / 3600) AS avg_hours
      FROM "affiliate_visits" v
      JOIN (
        SELECT "sessionId", MIN("createdAt") AS min_at
        FROM "affiliate_visits"
        WHERE "sessionId" IS NOT NULL
        GROUP BY "sessionId"
      ) first_visit ON first_visit."sessionId" = v."sessionId"
      WHERE v."convertedOrderId" IS NOT NULL
        AND v."convertedAt" BETWEEN ${filter.dateFrom} AND ${filter.dateTo}
        ${affiliateFilter}
    `;
    const avg = rows[0]?.avg_hours;
    if (avg == null) return 0;
    const n = Number(avg);
    return Number.isFinite(n) ? roundTo2(n) : 0;
  }

  async getCommissionTimeSeries(opts: {
    dateFrom: Date;
    dateTo: Date;
    granularity: Granularity;
    affiliateId?: string;
  }): Promise<TimeSeriesPoint[]> {
    this.assertRangeValid(opts.dateFrom, opts.dateTo);
    const granularity: Granularity = ['day', 'week', 'month'].includes(
      opts.granularity,
    )
      ? opts.granularity
      : 'day';

    const trunc = granularity;
    const rows = opts.affiliateId
      ? await this.prisma.$queryRaw<{ bucket: Date; total: string }[]>`
          SELECT date_trunc(${trunc}, "createdAt") AS bucket,
                 COALESCE(SUM("commissionAmount"), 0)::text AS total
          FROM "affiliate_commissions"
          WHERE "createdAt" BETWEEN ${opts.dateFrom} AND ${opts.dateTo}
            AND status IN ('PENDING', 'APPROVED')
            AND "affiliateId" = ${opts.affiliateId}
          GROUP BY bucket
          ORDER BY bucket ASC
        `
      : await this.prisma.$queryRaw<{ bucket: Date; total: string }[]>`
          SELECT date_trunc(${trunc}, "createdAt") AS bucket,
                 COALESCE(SUM("commissionAmount"), 0)::text AS total
          FROM "affiliate_commissions"
          WHERE "createdAt" BETWEEN ${opts.dateFrom} AND ${opts.dateTo}
            AND status IN ('PENDING', 'APPROVED')
          GROUP BY bucket
          ORDER BY bucket ASC
        `;

    return rows.map((r) => ({
      date: new Date(r.bucket),
      total: roundTo2(Number(r.total)),
    }));
  }

  async getTopProducts(opts: {
    dateFrom: Date;
    dateTo: Date;
    limit: number;
    affiliateId?: string;
  }): Promise<TopProduct[]> {
    this.assertRangeValid(opts.dateFrom, opts.dateTo);
    const take = clamp(opts.limit, 1, 100);
    const rows = opts.affiliateId
      ? await this.prisma.$queryRaw<
          {
            productId: string;
            productName: string;
            totalCommissions: string;
            totalOrders: bigint;
          }[]
        >`
          SELECT oi."productId" AS "productId",
                 oi."productName" AS "productName",
                 COALESCE(SUM(ac."commissionAmount"), 0)::text AS "totalCommissions",
                 COUNT(DISTINCT ac."orderId") AS "totalOrders"
          FROM "affiliate_commissions" ac
          JOIN "order_items" oi ON oi.id = ac."orderItemId"
          WHERE ac."createdAt" BETWEEN ${opts.dateFrom} AND ${opts.dateTo}
            AND ac.status IN ('PENDING', 'APPROVED')
            AND oi."productId" IS NOT NULL
            AND ac."affiliateId" = ${opts.affiliateId}
          GROUP BY oi."productId", oi."productName"
          ORDER BY SUM(ac."commissionAmount") DESC NULLS LAST
          LIMIT ${take}
        `
      : await this.prisma.$queryRaw<
          {
            productId: string;
            productName: string;
            totalCommissions: string;
            totalOrders: bigint;
          }[]
        >`
          SELECT oi."productId" AS "productId",
                 oi."productName" AS "productName",
                 COALESCE(SUM(ac."commissionAmount"), 0)::text AS "totalCommissions",
                 COUNT(DISTINCT ac."orderId") AS "totalOrders"
          FROM "affiliate_commissions" ac
          JOIN "order_items" oi ON oi.id = ac."orderItemId"
          WHERE ac."createdAt" BETWEEN ${opts.dateFrom} AND ${opts.dateTo}
            AND ac.status IN ('PENDING', 'APPROVED')
            AND oi."productId" IS NOT NULL
          GROUP BY oi."productId", oi."productName"
          ORDER BY SUM(ac."commissionAmount") DESC NULLS LAST
          LIMIT ${take}
        `;

    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName ?? '—',
      totalCommissions: roundTo2(Number(r.totalCommissions)),
      totalOrders: Number(r.totalOrders),
    }));
  }

  async getTopAffiliates(opts: {
    dateFrom: Date;
    dateTo: Date;
    limit: number;
  }): Promise<TopAffiliate[]> {
    this.assertRangeValid(opts.dateFrom, opts.dateTo);
    const take = clamp(opts.limit, 1, 100);
    const rows = await this.prisma.$queryRaw<
      {
        affiliateId: string;
        name: string | null;
        email: string;
        publicId: number;
        totalCommissions: string;
        totalOrders: bigint;
      }[]
    >`
      SELECT aa.id AS "affiliateId",
             u.name AS name,
             u.email AS email,
             aa."publicId" AS "publicId",
             COALESCE(SUM(ac."commissionAmount"), 0)::text AS "totalCommissions",
             COUNT(DISTINCT ac."orderId") AS "totalOrders"
      FROM "affiliate_accounts" aa
      JOIN "users" u ON u.id = aa."userId"
      JOIN "affiliate_commissions" ac ON ac."affiliateId" = aa.id
      WHERE ac."createdAt" BETWEEN ${opts.dateFrom} AND ${opts.dateTo}
        AND ac.status IN ('PENDING', 'APPROVED')
      GROUP BY aa.id, u.name, u.email, aa."publicId"
      ORDER BY SUM(ac."commissionAmount") DESC NULLS LAST
      LIMIT ${take}
    `;

    return rows.map((r) => ({
      affiliateId: r.affiliateId,
      publicId: Number(r.publicId),
      name: r.name,
      email: r.email,
      totalCommissions: roundTo2(Number(r.totalCommissions)),
      totalOrders: Number(r.totalOrders),
    }));
  }

  async getAffiliateOverview(affiliateId: string): Promise<AffiliateOverview> {
    const last30 = new Date(Date.now() - 30 * 86400_000);

    const [balance, pendingRes, approvedRes, cancelledRes, paidRes, v30, c30] =
      await Promise.all([
        this.ledger.currentBalance(affiliateId),
        this.prisma.affiliateCommission.aggregate({
          _sum: { commissionAmount: true },
          where: { affiliateId, status: 'PENDING' },
        }),
        this.prisma.affiliateCommission.aggregate({
          _sum: { commissionAmount: true },
          where: { affiliateId, status: 'APPROVED' },
        }),
        this.prisma.affiliateCommission.aggregate({
          _sum: { commissionAmount: true },
          where: { affiliateId, status: 'CANCELLED' },
        }),
        this.prisma.affiliateLedgerEntry.aggregate({
          _sum: { amount: true },
          where: { affiliateId, type: 'DEBIT', source: 'PAYMENT' },
        }),
        this.prisma.affiliateVisit.count({
          where: { affiliateId, createdAt: { gte: last30 } },
        }),
        this.prisma.order.count({
          where: {
            referringAffiliateId: affiliateId,
            createdAt: { gte: last30 },
          },
        }),
      ]);

    return {
      currentBalance: roundTo2(balance),
      pendingCommissions: toNum(pendingRes._sum.commissionAmount),
      approvedCommissions: toNum(approvedRes._sum.commissionAmount),
      cancelledCommissions: toNum(cancelledRes._sum.commissionAmount),
      paidLifetime: toNum(paidRes._sum.amount),
      visits30d: v30,
      conversions30d: c30,
    };
  }

  private assertRangeValid(dateFrom: Date, dateTo: Date): void {
    if (dateFrom > dateTo) {
      throw new BadRequestException('dateFrom nao pode ser maior que dateTo');
    }
    const diffDays = Math.ceil(
      (dateTo.getTime() - dateFrom.getTime()) / 86400_000,
    );
    if (diffDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Range maximo: ${MAX_RANGE_DAYS} dias (recebido ${diffDays}).`,
      );
    }
  }
}

function toNum(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? roundTo2(n) : 0;
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(n), min), max);
}
