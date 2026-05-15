import { Injectable, Logger } from '@nestjs/common';
import { CommissionSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export interface ResolveResult {
  affiliateId: string;
  source: CommissionSource;
}

@Injectable()
export class AffiliateResolverService {
  private readonly logger = new Logger(AffiliateResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async resolve(orderId: string): Promise<ResolveResult | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        referringAffiliateId: true,
        referringAffiliate: {
          select: { id: true, status: true, userId: true },
        },

        coupons: {
          orderBy: { position: 'asc' },
          select: {
            coupon: {
              select: {
                affiliateId: true,
                affiliate: {
                  select: { id: true, status: true, userId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!order) return null;

    const deployedAtRaw = await this.settings.get(
      'affiliate_module_deployed_at',
    );
    if (deployedAtRaw) {
      const deployedAt = new Date(deployedAtRaw);
      if (!isNaN(deployedAt.getTime()) && order.createdAt < deployedAt) {
        return null;
      }
    }

    const excludeSelf =
      (await this.settings.get('affiliate_exclude_self_referral')) !== 'false';

    for (const oc of order.coupons) {
      const couponAff = oc.coupon?.affiliate;
      if (
        couponAff &&
        couponAff.status === 'APPROVED' &&
        !(excludeSelf && couponAff.userId === order.userId)
      ) {
        return { affiliateId: couponAff.id, source: 'COUPON' };
      }
    }

    const cookieAff = order.referringAffiliate;
    if (
      cookieAff &&
      cookieAff.status === 'APPROVED' &&
      !(excludeSelf && cookieAff.userId === order.userId)
    ) {
      return { affiliateId: cookieAff.id, source: 'REFERRAL_COOKIE' };
    }

    return null;
  }
}
