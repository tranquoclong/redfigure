import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import slugify from 'slug';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ColorsService {
  constructor(private prisma: PrismaService) { }

  async create(dto: { name: string }) {
    const slug = slugify(dto.name, { lower: true });

    const existing = await this.prisma.color.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Color name already exists');
    }

    return this.prisma.color.create({
      data: { name: dto.name, slug },
    });
  }

  async findAll() {
    return this.prisma.color.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const color = await this.prisma.color.findUnique({ where: { id } });
    if (!color) throw new NotFoundException('Color not found');
    return color;
  }

  async update(id: string, dto: { name?: string }) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = slugify(dto.name, { lower: true });
    }
    return this.prisma.color.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.color.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
