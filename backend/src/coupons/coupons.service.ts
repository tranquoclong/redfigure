import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export const MAX_STACKED_COUPONS = 3;

@Injectable()
export class CouponsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) { }

  async create(dto: {
    code: string;
    type: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
    value: number;
    minOrderValue?: number;
    maxUses?: number;
    usesPerUser?: number;
    validFrom?: Date;
    validUntil?: Date;
    isFirstPurchaseOnly?: boolean;
    isFreeShipping?: boolean;
    categoryId?: string;
    tagId?: string;
    userId?: string;
    affiliateId?: string;
    stackable?: boolean;
    stackableWithIds?: string[];
  }) {
    await this.validateAffiliate(dto.affiliateId);

    return this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type,
        value: dto.value,
        minOrderValue: dto.minOrderValue,
        maxUses: dto.maxUses,
        usesPerUser: dto.usesPerUser,
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
        isFirstPurchaseOnly: dto.isFirstPurchaseOnly ?? false,
        isFreeShipping: dto.isFreeShipping ?? false,
        categoryId: dto.categoryId,
        tagId: dto.tagId,
        userId: dto.userId,
        affiliateId: dto.affiliateId,
        stackable: dto.stackable ?? false,

        ...(dto.stackableWithIds && dto.stackableWithIds.length > 0
          ? {
            stackableWith: {
              connect: dto.stackableWithIds.map((id) => ({ id })),
            },
          }
          : {}),
      },
    });
  }

  private async validateAffiliate(affiliateId: string | null | undefined) {
    if (!affiliateId) return;
    const affiliate = await this.prisma.affiliateAccount.findUnique({
      where: { id: affiliateId },
      select: { id: true, status: true },
    });
    if (!affiliate) {
      throw new NotFoundException('Affiliate not found');
    }
    if (affiliate.status !== 'APPROVED') {
      throw new BadRequestException(
        `Affiliate must be APPROVED (current: ${affiliate.status})`,
      );
    }
  }

  async findAll() {
    return this.prisma.coupon.findMany({
      include: {
        _count: { select: { usages: true } },
        category: { select: { id: true, name: true } },
        tag: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        affiliate: {
          select: {
            id: true,
            publicId: true,
            status: true,
            user: { select: { name: true, email: true } },
          },
        },

        stackableWith: { select: { id: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validate(params: {
    code: string;
    cartValue: number;
    userId?: string;

    appliedCouponIds?: string[];
  }): Promise<{
    discount: number;
    type: string;
    value: number;
    couponId: string;
    categoryId?: string | null;
    tagId?: string | null;
    isFreeShipping?: boolean;
    stackable: boolean;
    stackableWithIds: string[];
  }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: params.code.toUpperCase() },
      include: {
        _count: { select: { usages: true } },
        stackableWith: { select: { id: true } },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is not active');
    }

    const now = new Date();

    if (coupon.validFrom && now < coupon.validFrom) {
      throw new BadRequestException('Coupon is not yet valid');
    }

    if (coupon.validUntil && now > coupon.validUntil) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.minOrderValue && params.cartValue < coupon.minOrderValue) {
      throw new BadRequestException(
        `Minimum order value is ${coupon.minOrderValue}`,
      );
    }

    if (coupon.maxUses && coupon._count.usages >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (params.userId && coupon.usesPerUser) {
      const userUsages = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, userId: params.userId },
      });
      if (userUsages >= coupon.usesPerUser) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    if (coupon.userId && coupon.userId !== params.userId) {
      throw new BadRequestException(
        'This coupon is not available for your account',
      );
    }

    if (params.userId && coupon.isFirstPurchaseOnly) {
      const orderCount = await this.prisma.order.count({
        where: {
          userId: params.userId,
          deletedAt: null,
          status: { notIn: ['CANCELLED'] as any },
        },
      });
      if (orderCount > 0) {
        throw new BadRequestException('This coupon is for first purchase only');
      }
    }

    const newStackableWithIds = coupon.stackableWith.map((s) => s.id);
    const appliedIds = params.appliedCouponIds ?? [];

    if (appliedIds.length > 0) {

      if (appliedIds.length >= MAX_STACKED_COUPONS) {
        throw new BadRequestException(
          `Maximum of ${MAX_STACKED_COUPONS} coupons per order`,
        );
      }

      const applied = await this.prisma.coupon.findMany({
        where: { id: { in: appliedIds } },
        include: { stackableWith: { select: { id: true } } },
      });

      if (!coupon.stackable) {
        const otherCodes = applied.map((a) => a.code).join(', ');
        throw new BadRequestException(
          `Coupon ${coupon.code} cannot be used with others (${otherCodes}). Remove others to use this one.`,
        );
      }

      for (const applied_ of applied) {
        if (!applied_.stackable) {
          throw new BadRequestException(
            `Coupon ${applied_.code} cannot be used with others. Remove it to use ${coupon.code}.`,
          );
        }

        if (
          newStackableWithIds.length > 0 &&
          !newStackableWithIds.includes(applied_.id)
        ) {
          throw new BadRequestException(
            `Coupon ${coupon.code} cannot be used with ${applied_.code}.`,
          );
        }

        const appliedWhitelist = applied_.stackableWith.map((s) => s.id);
        if (
          appliedWhitelist.length > 0 &&
          !appliedWhitelist.includes(coupon.id)
        ) {
          throw new BadRequestException(
            `Coupon ${applied_.code} does not accept combinations with ${coupon.code}.`,
          );
        }
      }
    }

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount =
        Math.round(params.cartValue * (coupon.value / 100) * 100) / 100;
    } else if (coupon.type === 'FIXED') {
      discount = Math.min(coupon.value, params.cartValue);
    }

    return {
      discount,
      type: coupon.type,
      value: coupon.value,
      couponId: coupon.id,
      categoryId: coupon.categoryId,
      tagId: coupon.tagId,
      isFreeShipping: coupon.isFreeShipping,
      stackable: coupon.stackable,
      stackableWithIds: newStackableWithIds,
    };
  }

  async update(
    id: string,
    dto: {
      code?: string;
      type?: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
      value?: number;
      minOrderValue?: number | null;
      maxUses?: number | null;
      usesPerUser?: number | null;
      validFrom?: Date | null;
      validUntil?: Date | null;
      isFirstPurchaseOnly?: boolean;
      isFreeShipping?: boolean;
      isActive?: boolean;
      categoryId?: string | null;
      tagId?: string | null;
      userId?: string | null;
      affiliateId?: string | null;
      stackable?: boolean;

      stackableWithIds?: string[];
    },
  ) {

    if (dto.affiliateId) {
      await this.validateAffiliate(dto.affiliateId);
    }
    const { stackableWithIds, ...rest } = dto;
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...rest,

        ...(stackableWithIds !== undefined
          ? {
            stackableWith: {
              set: stackableWithIds.map((id_) => ({ id: id_ })),
            },
          }
          : {}),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createAbandonmentReward(params: {
    userId: string;
    type: 'PERCENTAGE' | 'FIXED';
    value: number;
    validUntil: Date;
    minOrderValue?: number;
  }) {
    const userPrefix = params.userId.slice(0, 8).toUpperCase();

    const code = `ABANDON-${userPrefix}-${randomBytes(8).toString('hex').toUpperCase()}`;
    return this.prisma.coupon.create({
      data: {
        code,
        type: params.type,
        value: params.value,
        minOrderValue:
          params.minOrderValue && params.minOrderValue > 0
            ? params.minOrderValue
            : undefined,
        maxUses: 1,
        usesPerUser: 1,
        validUntil: params.validUntil,
        userId: params.userId,
        stackable: false,
      },
    });
  }

  async createReviewReward(userId: string, tx?: Prisma.TransactionClient) {
    const cfg = await this.settings.getReviewSettings();

    const code = `REVIEW-${randomBytes(8).toString('hex').toUpperCase()}`;
    const validUntil = new Date(Date.now() + cfg.couponValidityDays * 86400000);

    const db = tx ?? this.prisma;

    return db.coupon.create({
      data: {
        code,
        type: cfg.couponType,
        value: cfg.couponValue,
        minOrderValue: cfg.couponMinOrder > 0 ? cfg.couponMinOrder : undefined,
        maxUses: 1,
        usesPerUser: 1,
        validUntil,
        userId,

        stackable: cfg.couponStackable,
      },
    });
  }
}
