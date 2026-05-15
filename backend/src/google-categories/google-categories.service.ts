import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SEARCH_LIMIT = 20;

@Injectable()
export class GoogleCategoriesService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const category = await this.prisma.googleCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Google category not found');
    return category;
  }

  async search(query: string, limit = DEFAULT_SEARCH_LIMIT) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    return this.prisma.googleCategory.findMany({
      where: {
        path: { contains: trimmed, mode: 'insensitive' },
      },
      orderBy: { path: 'asc' },
      take: limit,
    });
  }
}
