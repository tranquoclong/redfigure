import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ITEMS = 18;

@Injectable()
export class RecentlyViewedService {
  constructor(private readonly prisma: PrismaService) {}

  resolveOwner(
    userId: string | undefined,
    sessionId: string | undefined,
  ): { userId: string | null; sessionId: string } {
    if (!sessionId) {
      throw new BadRequestException('x-session-id header is required');
    }
    return { userId: userId ?? null, sessionId };
  }

  async recordView(
    userId: string | null,
    sessionId: string,
    productId: string,
  ): Promise<void> {
    await this.prisma.recentlyViewed.upsert({
      where: {
        sessionId_productId: { sessionId, productId },
      },
      update: {
        viewedAt: new Date(),
        ...(userId ? { userId } : {}),
      },
      create: {
        sessionId,
        productId,
        userId,
      },
    });
  }

  async getViewed(userId: string | null, sessionId: string): Promise<string[]> {
    const where = userId ? { userId } : { sessionId, userId: null };

    const records = await this.prisma.recentlyViewed.findMany({
      where,
      select: { productId: true },
      orderBy: { viewedAt: 'desc' },
      take: MAX_ITEMS,
    });

    return records.map((r) => r.productId);
  }

  async getViewedByUserId(userId: string): Promise<string[]> {
    const records = await this.prisma.recentlyViewed.findMany({
      where: { userId },
      select: { productId: true },
      orderBy: { viewedAt: 'desc' },
      take: MAX_ITEMS,
    });

    return records.map((r) => r.productId);
  }

  async merge(userId: string, sessionId: string): Promise<void> {

    const existing = await this.prisma.recentlyViewed.findMany({
      where: { userId },
      select: { productId: true },
    });
    const existingIds = new Set(existing.map((r) => r.productId));

    await this.prisma.recentlyViewed.updateMany({
      where: {
        sessionId,
        userId: null,
        productId: { notIn: [...existingIds] },
      },
      data: { userId },
    });

    await this.prisma.recentlyViewed.deleteMany({
      where: { sessionId, userId: null },
    });
  }

  async cleanupAnonymous(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.recentlyViewed.deleteMany({
      where: {
        userId: null,
        viewedAt: { lt: cutoff },
      },
    });

    return result.count;
  }
}
