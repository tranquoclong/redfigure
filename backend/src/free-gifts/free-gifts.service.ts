import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const ACTIVE_GIFT_CACHE_KEY = 'cache:free-gift:active:v1';
const ACTIVE_GIFT_CACHE_TTL_SEC = 60;

const ACTIVE_GIFT_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      isActive: true,
      isDraft: true,
      images: {
        orderBy: { order: 'asc' as const },
        take: 1,
        include: { mediaFile: { select: { thumb: true, card: true } } },
      },
    },
  },
} satisfies Prisma.FreeGiftInclude;

export type FreeGiftWithProduct = Prisma.FreeGiftGetPayload<{
  include: typeof ACTIVE_GIFT_INCLUDE;
}>;

export interface FreeGiftPublic {
  id: string;
  minOrderAmount: number;
  label: string;
  product: {
    id: string;
    name: string;
    slug: string;
    image?: string;
  };
}

interface CacheEnvelope {

  value: FreeGiftPublic | null;
}

@Injectable()
export class FreeGiftsService {
  private readonly logger = new Logger(FreeGiftsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) { }

  async getActiveGift(now: Date = new Date()): Promise<FreeGiftPublic | null> {

    const cached = await this.redis
      .getJson<CacheEnvelope>(ACTIVE_GIFT_CACHE_KEY)
      .catch(() => null);
    if (cached && typeof cached === 'object' && 'value' in cached) {
      return cached.value;
    }

    const candidates = await this.prisma.freeGift.findMany({
      where: {
        isActive: true,

        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      include: ACTIVE_GIFT_INCLUDE,

      orderBy: [{ minOrderAmount: 'desc' }, { createdAt: 'desc' }],
    });

    const valid = candidates
      .filter((g) => g.product.isActive && !g.product.isDraft)
      .sort((a, b) => {
        if (b.minOrderAmount !== a.minOrderAmount) {
          return b.minOrderAmount - a.minOrderAmount;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      })[0];

    const publicGift = valid ? this.toPublic(valid) : null;

    void this.redis
      .setJson(
        ACTIVE_GIFT_CACHE_KEY,
        { value: publicGift } as CacheEnvelope,
        ACTIVE_GIFT_CACHE_TTL_SEC,
      )
      .catch((err) =>
        this.logger.warn(
          `Error saving free-gift cache: ${(err as Error).message}`,
        ),
      );

    return publicGift;
  }

  async findByIdInternal(id: string): Promise<FreeGiftWithProduct | null> {
    return this.prisma.freeGift.findUnique({
      where: { id },
      include: ACTIVE_GIFT_INCLUDE,
    });
  }

  async findAll() {
    return this.prisma.freeGift.findMany({
      include: ACTIVE_GIFT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<FreeGiftWithProduct> {
    const gift = await this.prisma.freeGift.findUnique({
      where: { id },
      include: ACTIVE_GIFT_INCLUDE,
    });
    if (!gift) {
      throw new NotFoundException('Free gift not found');
    }
    return gift;
  }

  async create(dto: {
    minOrderAmount: number;
    productId: string;
    label?: string;
    startsAt?: Date | string;
    endsAt?: Date | string;
    isActive?: boolean;
  }): Promise<FreeGiftWithProduct> {
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

    this.assertPeriodValid(startsAt, endsAt);
    await this.assertProductEligible(dto.productId);

    await this.invalidateCache();

    return this.prisma.freeGift.create({
      data: {
        minOrderAmount: dto.minOrderAmount,
        productId: dto.productId,
        label: dto.label,
        startsAt: startsAt ?? undefined,
        endsAt: endsAt ?? undefined,
        isActive: dto.isActive ?? true,
      },
      include: ACTIVE_GIFT_INCLUDE,
    });
  }

  async update(
    id: string,
    dto: {
      minOrderAmount?: number;
      productId?: string;
      label?: string;
      startsAt?: Date | string | null;
      endsAt?: Date | string | null;
      isActive?: boolean;
    },
  ): Promise<FreeGiftWithProduct> {
    const existing = await this.prisma.freeGift.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Free gift not found');
    }

    const finalStartsAt =
      dto.startsAt === undefined
        ? existing.startsAt
        : dto.startsAt === null
          ? null
          : new Date(dto.startsAt);
    const finalEndsAt =
      dto.endsAt === undefined
        ? existing.endsAt
        : dto.endsAt === null
          ? null
          : new Date(dto.endsAt);
    this.assertPeriodValid(finalStartsAt, finalEndsAt);

    if (dto.productId && dto.productId !== existing.productId) {
      await this.assertProductEligible(dto.productId);
    }

    await this.invalidateCache();

    return this.prisma.freeGift.update({
      where: { id },
      data: {
        minOrderAmount: dto.minOrderAmount,
        productId: dto.productId,
        label: dto.label,
        startsAt:
          dto.startsAt === undefined
            ? undefined
            : dto.startsAt === null
              ? null
              : new Date(dto.startsAt),
        endsAt:
          dto.endsAt === undefined
            ? undefined
            : dto.endsAt === null
              ? null
              : new Date(dto.endsAt),
        isActive: dto.isActive,
      },
      include: ACTIVE_GIFT_INCLUDE,
    });
  }

  async remove(id: string): Promise<void> {
    await this.invalidateCache();
    try {
      await this.prisma.freeGift.delete({ where: { id } });
    } catch (err) {

      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('Free gift not found');
      }
      throw err;
    }
  }

  private assertPeriodValid(startsAt: Date | null, endsAt: Date | null): void {
    if (startsAt && endsAt && endsAt < startsAt) {
      throw new BadRequestException(
        'End date must be after start date',
      );
    }
  }

  private async assertProductEligible(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, type: true, isActive: true, isDraft: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (!product.isActive || product.isDraft) {
      throw new BadRequestException(
        'Inactive product cannot be configured as a gift',
      );
    }
    if (product.type !== 'simple') {
      throw new BadRequestException(
        'Only simple products (without variation or bundle) can be gifts',
      );
    }
  }

  private async invalidateCache(): Promise<void> {
    try {
      await this.redis.del(ACTIVE_GIFT_CACHE_KEY);
    } catch (err) {
      this.logger.warn(
        `Error invalidating free-gift cache: ${(err as Error).message}`,
      );
    }
  }

  private toPublic(gift: FreeGiftWithProduct): FreeGiftPublic {
    const firstImage = gift.product.images[0];
    return {
      id: gift.id,
      minOrderAmount: gift.minOrderAmount,
      label: gift.label,
      product: {
        id: gift.product.id,
        name: gift.product.name,
        slug: gift.product.slug,
        image: firstImage?.mediaFile?.card ?? firstImage?.mediaFile?.thumb,
      },
    };
  }
}
