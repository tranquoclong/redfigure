import { Injectable, Logger } from '@nestjs/common';
import { CommissionSource, CommissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateResolverService } from './affiliate-resolver.service';
import { AffiliateCommissionRulesService } from './affiliate-commission-rules.service';
import { CategoriesService } from '../categories/categories.service';
import {
  computeBaseAmount,
  CommissionMathItem,
} from './affiliate-commission-math';

@Injectable()
export class AffiliateCommissionService {
  private readonly logger = new Logger(AffiliateCommissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: AffiliateResolverService,
    private readonly rulesService: AffiliateCommissionRulesService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async createForOrder(orderId: string): Promise<void> {
    const resolved = await this.resolver.resolve(orderId);
    if (!resolved) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { id: true, type: true } },
          },
        },

        coupons: {

          orderBy: { position: 'asc' },
          select: {
            coupon: {
              select: {
                id: true,
                categoryId: true,
                tagId: true,
                affiliateId: true,
              },
            },
          },
        },
      },
    });
    if (!order) return;

    const eligibleItems = this.filterEligibleItems(order.items);
    if (eligibleItems.length === 0) return;

    const winningCouponData = order.coupons
      .map((oc) => oc.coupon)
      .find((c) => c?.affiliateId === resolved.affiliateId);
    const itemsInScope = await this.resolveCouponScope(
      eligibleItems,
      winningCouponData
        ? {
            id: winningCouponData.id,
            categoryId: winningCouponData.categoryId,
            tagId: winningCouponData.tagId,
          }
        : null,
    );

    const mathItems: CommissionMathItem[] = eligibleItems.map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      price: i.price,
      discount: i.discount ?? 0,
    }));
    const scopeMath = mathItems.filter((mi) =>
      itemsInScope.some((ie) => ie.id === mi.id),
    );

    const commissionsToCreate: Array<{
      affiliateId: string;
      orderId: string;
      orderItemId: string;
      status: 'PENDING';
      source: CommissionSource;
      baseAmount: number;
      rate: number;
      commissionAmount: number;
    }> = [];

    for (const item of mathItems) {
      if (!item.productId) continue;

      const rawRate = await this.rulesService.resolveRate(item.productId);

      const rate = Math.min(Math.max(rawRate, 0), 100);
      if (rate <= 0) continue;

      const baseAmount = computeBaseAmount({
        item,
        allItems: mathItems,
        itemsInScope: scopeMath,
        couponDiscount: order.discount ?? 0,
      });

      const rawCommission = (baseAmount * rate) / 100;
      const commissionAmount = Math.min(
        roundTo2(rawCommission),
        roundTo2(baseAmount),
      );

      commissionsToCreate.push({
        affiliateId: resolved.affiliateId,
        orderId,
        orderItemId: item.id,
        status: 'PENDING',
        source: resolved.source as CommissionSource,
        baseAmount: roundTo2(baseAmount),
        rate,
        commissionAmount,
      });
    }

    if (commissionsToCreate.length === 0) return;

    try {
      await this.prisma.affiliateCommission.createMany({
        data: commissionsToCreate,
        skipDuplicates: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to create commissions for order ${orderId}: ${msg}`,
      );
    }
  }

  async listForOrder(orderId: string) {
    return this.prisma.affiliateCommission.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: {
        orderItem: {
          select: {
            id: true,
            productName: true,
            productSku: true,
            quantity: true,
            price: true,
          },
        },
        affiliate: {
          select: {
            id: true,
            publicId: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
  }

  private filterEligibleItems<
    T extends {
      productId: string | null;
      product?: { type?: string } | null;
    },
  >(items: T[]): T[] {
    return items.filter((item) => {
      if (!item.productId) return false;
      if (item.product?.type === 'bundle') return false;
      return true;
    });
  }

  private async resolveCouponScope<
    T extends { id: string; productId: string | null },
  >(
    items: T[],
    coupon: {
      id: string;
      categoryId: string | null;
      tagId: string | null;
    } | null,
  ): Promise<T[]> {
    if (!coupon) return items;
    if (!coupon.categoryId && !coupon.tagId) return items;

    const productIds = items
      .map((i) => i.productId)
      .filter(Boolean) as string[];

    if (coupon.categoryId) {

      const descendantIds = await this.categoriesService.getDescendantIds(
        coupon.categoryId,
      );
      const validCatIds = [coupon.categoryId, ...descendantIds];
      const cats = await this.prisma.productCategory.findMany({
        where: {
          productId: { in: productIds },
          categoryId: { in: validCatIds },
        },
        select: { productId: true },
      });
      const covered = new Set(cats.map((c) => c.productId));
      return items.filter((i) => i.productId && covered.has(i.productId));
    }

    if (coupon.tagId) {
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          tags: { some: { id: coupon.tagId } },
        },
        select: { id: true },
      });
      const covered = new Set(products.map((p) => p.id));
      return items.filter((i) => i.productId && covered.has(i.productId));
    }

    return items;
  }

  async listCommissionsForAffiliate(
    affiliateId: string,
    opts: {
      page?: number;
      perPage?: number;
      status?: CommissionStatus;
    },
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.max(1, Math.min(opts.perPage ?? 50, 100));
    const where: Prisma.AffiliateCommissionWhereInput = { affiliateId };
    if (opts.status) where.status = opts.status;

    const [rows, total] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          order: {
            select: { id: true, number: true, createdAt: true },
          },
          orderItem: {
            select: { productName: true, quantity: true },
          },
        },
      }),
      this.prisma.affiliateCommission.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        status: r.status,
        source: r.source,
        baseAmount: r.baseAmount.toString(),
        rate: r.rate.toString(),
        commissionAmount: r.commissionAmount.toString(),
        createdAt: r.createdAt,
        approvedAt: r.approvedAt,
        cancelledAt: r.cancelledAt,
        cancelReason: r.cancelReason,
        order: {
          number: r.order.number,
          createdAt: r.order.createdAt,
        },
        productName: r.orderItem.productName,
        quantity: r.orderItem.quantity,
      })),
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}
