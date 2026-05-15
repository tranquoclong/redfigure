import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';

function tombstoneSlug(slug: string): string {

  return `${slug}__del__${randomUUID()}`;
}

@Injectable()
export class AttributesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { name: string; isFilter?: boolean }) {
    const slug = slugify(dto.name, { lower: true });

    const existing = await this.prisma.attribute.findUnique({
      where: { slug },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('Attribute already exists');
    }

    try {
      return await this.prisma.attribute.create({
        data: { name: dto.name, slug, isFilter: dto.isFilter ?? false },
      });
    } catch (err: any) {

      if (err?.code === 'P2002') {
        throw new ConflictException('Attribute already exists');
      }
      throw err;
    }
  }

  async findAll() {
    return this.prisma.attribute.findMany({
      where: { deletedAt: null },
      include: {
        values: {
          where: { deletedAt: null },
          orderBy: { value: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const attr = await this.prisma.attribute.findUnique({
      where: { slug },
      include: { values: { where: { deletedAt: null } } },
    });
    if (!attr || attr.deletedAt)
      throw new NotFoundException('Attribute not found');
    return attr;
  }

  async update(id: string, dto: { name?: string; isFilter?: boolean }) {
    const data: Record<string, any> = {};
    if (dto.name) {
      data.name = dto.name;
      data.slug = slugify(dto.name, { lower: true });
    }
    if (dto.isFilter !== undefined) {
      data.isFilter = dto.isFilter;
    }
    return this.prisma.attribute.update({ where: { id }, data });
  }

  async delete(id: string) {
    const attr = await this.prisma.attribute.findUnique({ where: { id } });
    if (!attr || attr.deletedAt) {
      throw new NotFoundException('Attribute not found');
    }

    const now = new Date();
    return this.prisma.attribute.update({
      where: { id },
      data: {
        deletedAt: now,
        slug: tombstoneSlug(attr.slug),
        values: {
          updateMany: {
            where: { deletedAt: null },
            data: { deletedAt: now },
          },
        },
      },
    });
  }

  async createValue(attributeId: string, dto: { value: string }) {
    const slug = slugify(dto.value, { lower: true });

    const existing = await this.prisma.attributeValue.findFirst({
      where: { attributeId, slug, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Value already exists for this attribute');
    }

    return this.prisma.attributeValue.create({
      data: { attributeId, value: dto.value, slug },
    });
  }

  async deleteValue(valueId: string) {
    const value = await this.prisma.attributeValue.findUnique({
      where: { id: valueId },
    });
    if (!value || value.deletedAt) {
      throw new NotFoundException('Attribute value not found');
    }

    return this.prisma.attributeValue.update({
      where: { id: valueId },
      data: {
        deletedAt: new Date(),
        slug: tombstoneSlug(value.slug),
      },
    });
  }
}
