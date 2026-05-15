import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    name: string;
    description?: string;
    logo?: string;
    skuPrefix?: string;
    renameFolderDefault?: boolean;
    scaleRuleSetId?: string | null;
    noScales?: boolean;
  }) {
    const slug = slugify(dto.name, { lower: true });

    const existing = await this.prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Brand name already exists');
    }

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        logo: dto.logo,
        skuPrefix: dto.skuPrefix || null,
        renameFolderDefault: dto.renameFolderDefault ?? true,
        scaleRuleSetId: dto.scaleRuleSetId || undefined,
        noScales: dto.noScales ?? false,
      } as any,
    });
  }

  async findAll() {
    return this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { skuCounter: { select: { counter: true } } },
    });
  }

  async findBySlug(slug: string) {
    const brand = await this.prisma.brand.findUnique({ where: { slug } });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }

  async update(
    id: string,
    dto: {
      name?: string;
      description?: string;
      logo?: string;
      skuPrefix?: string;
      renameFolderDefault?: boolean;
      skuCounter?: number;
      scaleRuleSetId?: string | null;
      noScales?: boolean;
    },
  ) {
    const { skuCounter, scaleRuleSetId, ...rest } = dto;
    const data: Record<string, any> = { ...rest };
    if (dto.name) {
      data.slug = slugify(dto.name, { lower: true });
    }
    if (dto.skuPrefix !== undefined) {
      data.skuPrefix = dto.skuPrefix || null;
    }
    if (scaleRuleSetId !== undefined) {
      data.scaleRuleSet = scaleRuleSetId
        ? { connect: { id: scaleRuleSetId } }
        : { disconnect: true };
    }

    const brand = await this.prisma.brand.update({ where: { id }, data });

    if (skuCounter !== undefined && skuCounter >= 0) {
      await this.prisma.skuCounter.upsert({
        where: { brandId: id },
        create: { brandId: id, counter: skuCounter },
        update: { counter: skuCounter },
      });
    }

    return brand;
  }

  async remove(id: string) {
    return this.prisma.brand.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
