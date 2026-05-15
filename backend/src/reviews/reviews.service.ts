import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeBlocksCaches } from '../site-config/home-blocks.types';
import { randomBytes } from 'crypto';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) { }

  async create(dto: {
    userId: string;
    productId: string;
    orderId: string;
    rating: number;
    comment?: string;
  }) {

    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== dto.userId) {
      throw new ForbiddenException('Order does not belong to you');
    }

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException(
        'You can only review products from delivered orders',
      );
    }

    const productInOrder = order.items.some(
      (item) => item.productId === dto.productId,
    );
    if (!productInOrder) {
      throw new BadRequestException('Product was not in this order');
    }

    const existing = await this.prisma.review.findFirst({
      where: {
        userId: dto.userId,
        productId: dto.productId,
        orderId: dto.orderId,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'You have already reviewed this product for this order',
      );
    }

    return this.prisma.review.create({
      data: {
        userId: dto.userId,
        productId: dto.productId,
        orderId: dto.orderId,
        rating: dto.rating,
        comment: dto.comment,

      },
    });
  }

  async findByProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, isApproved: true },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setHighlightedOnHome(reviewId: string, isHighlighted: boolean) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, isApproved: true },
    });
    if (!review) {
      throw new NotFoundException(`Review ${reviewId} not found`);
    }
    if (!review.isApproved && isHighlighted) {
      throw new UnprocessableEntityException(
        'Cannot highlight an unapproved review. Approve first.',
      );
    }
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { isHighlightedOnHome: isHighlighted },
    });

    await invalidateHomeBlocksCaches(this.redis);
    return updated;
  }

  async findHighlighted({ limit = 3 }: { limit?: number } = {}) {
    const cap = Math.max(1, Math.min(12, Math.floor(limit)));
    return this.prisma.review.findMany({
      where: {
        isApproved: true,
        isHighlightedOnHome: true,
      },
      include: {
        user: { select: { name: true } },
        product: {
          select: {
            id: true,
            slug: true,
            name: true,

            images: {
              select: {
                isMain: true,
                order: true,
                mediaFile: { select: { card: true, full: true } },
              },
              orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: cap,
    });
  }

  async getAverageRating(productId: string) {
    const result = await this.prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      average: result._avg.rating ?? 0,
      count: result._count.rating ?? 0,
    };
  }

  async getRatingDistribution(
    productId: string,
  ): Promise<Record<'5' | '4' | '3' | '2' | '1', number>> {
    const grouped = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId, isApproved: true },
      _count: { rating: true },
    });
    const dist: Record<'5' | '4' | '3' | '2' | '1', number> = {
      '5': 0,
      '4': 0,
      '3': 0,
      '2': 0,
      '1': 0,
    };
    for (const row of grouped) {
      const key = String(row.rating) as '5' | '4' | '3' | '2' | '1';
      if (key in dist) dist[key] = row._count.rating;
    }
    return dist;
  }

  async approve(reviewId: string) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
    });
  }

  async hasExistingReward(reviewId: string): Promise<boolean> {
    const reward = await this.prisma.reviewReward.findFirst({
      where: { reviewId },
      select: { id: true },
    });
    return reward !== null;
  }

  async findAllAdmin() {
    return this.prisma.review.findMany({
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateReward(reviewId: string, _userId: string) {

    const code = `REVIEW-${randomBytes(8).toString('hex').toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.create({
        data: {
          code,
          type: 'PERCENTAGE',
          value: 5,
          usesPerUser: 1,
          maxUses: 1,
          isActive: true,
        },
      });

      return tx.reviewReward.create({
        data: {
          reviewId,
          couponId: coupon.id,
        },
      });
    });
  }
}
