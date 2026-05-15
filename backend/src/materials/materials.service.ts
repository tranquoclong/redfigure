import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import slugify from 'slug';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { name: string }) {
    const slug = slugify(dto.name, { lower: true });

    const existing = await this.prisma.material.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Material name already exists');
    }

    return this.prisma.material.create({
      data: { name: dto.name, slug },
    });
  }

  async findAll() {
    return this.prisma.material.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  async update(id: string, dto: { name?: string }) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = slugify(dto.name, { lower: true });
    }
    return this.prisma.material.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.material.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
