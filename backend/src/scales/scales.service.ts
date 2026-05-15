import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class ScalesService {
  constructor(
    private prisma: PrismaService,
    private categoriesService: CategoriesService,
  ) {}

  async createRuleSet(dto: { name: string }) {
    return this.prisma.scaleRuleSet.create({
      data: { name: dto.name },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findAllRuleSets() {
    return this.prisma.scaleRuleSet.findMany({
      where: { isActive: true },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findRuleSetById(id: string) {
    const ruleSet = await this.prisma.scaleRuleSet.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!ruleSet) throw new NotFoundException('Scale rule set not found');
    return ruleSet;
  }

  async updateRuleSet(id: string, dto: { name?: string }) {
    await this.findRuleSetById(id);
    return this.prisma.scaleRuleSet.update({
      where: { id },
      data: { name: dto.name },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async removeRuleSet(id: string) {
    await this.findRuleSetById(id);

    return this.prisma.scaleRuleSet.delete({ where: { id } });
  }

  async addItem(
    ruleSetId: string,
    dto: { name: string; percentageIncrease: number; sortOrder?: number },
  ) {
    await this.findRuleSetById(ruleSetId);
    return this.prisma.scaleRuleItem.create({
      data: {
        ruleSetId,
        name: dto.name,
        percentageIncrease: dto.percentageIncrease,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateItem(
    itemId: string,
    dto: { name?: string; percentageIncrease?: number; sortOrder?: number },
  ) {
    const item = await this.prisma.scaleRuleItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Scale rule item not found');
    return this.prisma.scaleRuleItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.scaleRuleItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Scale rule item not found');
    return this.prisma.scaleRuleItem.delete({ where: { id: itemId } });
  }

  async reorderItems(ruleSetId: string, itemIds: string[]) {
    await this.findRuleSetById(ruleSetId);
    await Promise.all(
      itemIds.map((id, index) =>
        this.prisma.scaleRuleItem.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.findRuleSetById(ruleSetId);
  }

  async resolveScaleRule(productId: string) {
    const scaleInclude = {
      include: { items: { orderBy: { sortOrder: 'asc' as const } } },
    };

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        scaleRuleSet: scaleInclude,
        tags: {
          include: { scaleRuleSet: scaleInclude },
        },
        brand: {
          include: { scaleRuleSet: scaleInclude },
        },
        productCategories: {
          include: {
            category: { include: { scaleRuleSet: scaleInclude } },
          },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    if (product.noScales) return null;

    if (product.scaleRuleSet) return product.scaleRuleSet;

    for (const tag of product.tags ?? []) {
      if ((tag as any).noScales) return null;
    }
    for (const tag of product.tags ?? []) {
      if ((tag as any).scaleRuleSet) return (tag as any).scaleRuleSet;
    }

    const brand = (product as any).brand;
    if (brand) {
      if (brand.noScales) return null;
      if (brand.scaleRuleSet) return brand.scaleRuleSet;
    }

    for (const pc of (product as any).productCategories ?? []) {
      if (pc.category?.scaleRuleSet) return pc.category.scaleRuleSet;
    }

    for (const pc of (product as any).productCategories ?? []) {
      const ancestors = await this.categoriesService.getAncestors(
        pc.categoryId,
      );
      for (const ancestor of ancestors) {
        if (ancestor.scaleRuleSetId) {
          const ruleSet = await this.prisma.scaleRuleSet.findUnique({
            where: { id: ancestor.scaleRuleSetId },
            ...scaleInclude,
          });
          if (ruleSet) return ruleSet;
        }
      }
    }

    return null;
  }

  calculateScalePrice(basePrice: number, percentageIncrease: number): number {
    return Math.round(basePrice * (1 + percentageIncrease / 100) * 100) / 100;
  }
}
