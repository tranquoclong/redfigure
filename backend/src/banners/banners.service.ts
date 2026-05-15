import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeBlocksCaches } from '../site-config/home-blocks.types';

export interface CreateBannerInput {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  imageUrl?: string;
  order?: number;
  isActive?: boolean;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export type UpdateBannerInput = Partial<CreateBannerInput>;

@Injectable()
export class BannersService {
  private readonly logger = new Logger(BannersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  private async invalidateHome() {
    await invalidateHomeBlocksCaches(this.redis, this.logger);
  }

  async findActive() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [{ startDate: null }, { startDate: { lte: now } }],
          },
          {
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        ],
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findAll() {
    return this.prisma.banner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException(`Banner ${id} not found`);
    }
    return banner;
  }

  async create(input: CreateBannerInput) {
    const banner = await this.prisma.banner.create({ data: input });
    await this.invalidateHome();
    return banner;
  }

  async update(id: string, input: UpdateBannerInput) {
    await this.findById(id);
    const banner = await this.prisma.banner.update({
      where: { id },
      data: input,
    });
    await this.invalidateHome();
    return banner;
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.banner.delete({ where: { id } });
    await this.invalidateHome();
  }

  async reorder(items: Array<{ id: string; order: number }>) {
    for (const item of items) {
      await this.prisma.banner.update({
        where: { id: item.id },
        data: { order: item.order },
      });
    }
    await this.invalidateHome();
  }
}
