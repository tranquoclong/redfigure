import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import slugify from 'slug';

const CATEGORIES_TREE_CACHE_KEY = 'cache:categories:tree:v1';
const CATEGORIES_TREE_CACHE_TTL_SEC = 600;

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  private fetchTreePromise: Promise<unknown[]> | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) { }

  private async invalidateTreeCache(): Promise<void> {
    try {
      await this.redis.del(CATEGORIES_TREE_CACHE_KEY);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate categories cache: ${(err as Error).message}`,
      );
    }
  }

  async create(dto: {
    name: string;
    description?: string;
    image?: string;
    parentId?: string;
    extraDays?: number;
    scaleRuleSetId?: string;
    colorId?: string;
    materialId?: string;
    googleCategoryId?: string;
  }) {
    const slug = slugify(dto.name, { lower: true });

    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Category name already exists');
    }

    const created = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        parentId: dto.parentId,
        extraDays: dto.extraDays,
        scaleRuleSetId: dto.scaleRuleSetId || undefined,
        colorId: dto.colorId || undefined,
        materialId: dto.materialId || undefined,
        googleCategoryId: dto.googleCategoryId || undefined,
      } as any,
    });
    await this.invalidateTreeCache();
    return created;
  }

  async getDescendantIds(categoryId: string): Promise<string[]> {
    const ids: string[] = [];
    let currentLevel = [categoryId];
    while (currentLevel.length > 0) {
      const children = await this.prisma.category.findMany({
        where: { parentId: { in: currentLevel }, isActive: true },
        select: { id: true },
      });
      currentLevel = children.map((c) => c.id);
      ids.push(...currentLevel);
    }
    return ids;
  }

  async getAncestors(categoryId: string): Promise<any[]> {
    const ancestors: any[] = [];
    let current = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    while (current?.parentId) {
      current = await this.prisma.category.findUnique({
        where: { id: current.parentId },
      });
      if (current) ancestors.push(current);
    }
    return ancestors;
  }

  async resolveInheritedField(
    categoryId: string,
    field: 'scaleRuleSetId' | 'extraDays',
  ): Promise<string | number | null> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) return null;

    if ((category as any)[field] != null) return (category as any)[field];

    const ancestors = await this.getAncestors(categoryId);
    for (const ancestor of ancestors) {
      if (ancestor[field] != null) return ancestor[field];
    }

    return null;
  }

  async findAll() {

    if (this.fetchTreePromise) return this.fetchTreePromise;

    this.fetchTreePromise = (async () => {
      try {
        const cached = await this.redis
          .getJson<unknown[]>(CATEGORIES_TREE_CACHE_KEY)
          .catch(() => null);
        if (cached) return cached;

        const tree = await this.prisma.category.findMany({
          where: { isActive: true, parentId: null },
          include: {
            children: {
              where: { isActive: true },
              include: { _count: { select: { productCategories: true } } },
            },
            _count: { select: { productCategories: true } },
          },
          orderBy: { name: 'asc' },
        });

        void this.redis
          .setJson(
            CATEGORIES_TREE_CACHE_KEY,
            tree,
            CATEGORIES_TREE_CACHE_TTL_SEC,
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to write categories cache: ${(err as Error).message}`,
            ),
          );

        return tree;
      } finally {
        this.fetchTreePromise = null;
      }
    })();

    return this.fetchTreePromise;
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: { where: { isActive: true } },
        _count: { select: { productCategories: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    dto: {
      name?: string;
      description?: string;
      image?: string;
      parentId?: string | null;
      extraDays?: number;
      scaleRuleSetId?: string | null;
      colorId?: string | null;
      materialId?: string | null;
      googleCategoryId?: string | null;
    },
  ) {
    const {
      parentId,
      scaleRuleSetId,
      colorId,
      materialId,
      googleCategoryId,
      ...rest
    } = dto;
    const data: Record<string, any> = { ...rest };

    if (dto.name) {
      const slug = slugify(dto.name, { lower: true });
      const existing = await this.prisma.category.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Category name already exists');
      }
      data.slug = slug;
    }

    if (parentId !== undefined) {
      data.parent = parentId
        ? { connect: { id: parentId } }
        : { disconnect: true };
    }
    if (scaleRuleSetId !== undefined) {
      data.scaleRuleSet = scaleRuleSetId
        ? { connect: { id: scaleRuleSetId } }
        : { disconnect: true };
    }
    if (colorId !== undefined) {
      data.color = colorId
        ? { connect: { id: colorId } }
        : { disconnect: true };
    }
    if (materialId !== undefined) {
      data.material = materialId
        ? { connect: { id: materialId } }
        : { disconnect: true };
    }
    if (googleCategoryId !== undefined) {
      data.googleCategory = googleCategoryId
        ? { connect: { id: googleCategoryId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.category.update({ where: { id }, data });
    await this.invalidateTreeCache();
    return updated;
  }

  async remove(id: string) {
    const deactivated = await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
    await this.invalidateTreeCache();
    return deactivated;
  }
}
