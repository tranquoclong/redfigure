import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeBlocksCaches } from '../site-config/home-blocks.types';

export interface CreateFeaturedCategoryInput {
  categoryId: string;
  glowColor: string;
  displayLabel?: string;
  order?: number;
  isActive?: boolean;
}

export type UpdateFeaturedCategoryInput = Partial<
  Omit<CreateFeaturedCategoryInput, 'categoryId'>
>;

@Injectable()
export class FeaturedCategoriesService {
  private readonly logger = new Logger(FeaturedCategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  private async invalidateHome() {
    await invalidateHomeBlocksCaches(this.redis, this.logger);
  }

  async findActive() {
    return this.prisma.featuredCategory.findMany({
      where: {
        isActive: true,
        category: { isActive: true },
      },
      include: { category: true },
      orderBy: { order: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.featuredCategory.findMany({
      include: { category: true },
      orderBy: { order: 'asc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.featuredCategory.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!item) {
      throw new NotFoundException(`FeaturedCategory ${id} not found`);
    }
    return item;
  }

  async create(input: CreateFeaturedCategoryInput) {

    const existing = await this.prisma.featuredCategory.findUnique({
      where: { categoryId: input.categoryId },
    });
    if (existing) {
      throw new ConflictException('This category is already featured');
    }
    const created = await this.prisma.featuredCategory.create({
      data: input,
      include: { category: true },
    });
    await this.invalidateHome();
    return created;
  }

  async update(id: string, input: UpdateFeaturedCategoryInput) {
    await this.findById(id);
    const updated = await this.prisma.featuredCategory.update({
      where: { id },
      data: input,
      include: { category: true },
    });
    await this.invalidateHome();
    return updated;
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.featuredCategory.delete({ where: { id } });
    await this.invalidateHome();
  }

  async reorder(items: Array<{ id: string; order: number }>) {
    for (const item of items) {
      await this.prisma.featuredCategory.update({
        where: { id: item.id },
        data: { order: item.order },
      });
    }
    await this.invalidateHome();
  }
}
