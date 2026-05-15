import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';

@Injectable()
export class BundlesService {
  constructor(private prisma: PrismaService) {}

  calculateBundlePrice(
    components: Array<{ basePrice: number; quantity: number }>,
    discount: number,
  ): number {

    const sum = components.reduce(

      (total, c) => total + c.basePrice * c.quantity,
      0,
    );

    return Math.round(sum * (1 - discount / 100) * 100) / 100;
  }

  async create(dto: {
    name: string;
    description?: string;
    discount: number;
    items: Array<{ productId: string; quantity: number }>;
  }) {
    return this.prisma.bundle.create({
      data: {
        name: dto.name,
        slug: slugify(dto.name, { lower: true }),
        description: dto.description,
        discount: dto.discount,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });
  }

  async findAll() {
    return this.prisma.bundle.findMany({
      where: { isActive: true },
      include: { items: true },
    });
  }

  async findBySlug(slug: string) {
    const bundle = await this.prisma.bundle.findUnique({
      where: { slug },
      include: { items: true },
    });

    if (!bundle) {
      throw new NotFoundException('Bundle not found');
    }

    const productIds = bundle.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, basePrice: true },
    });

    const priceMap = new Map(products.map((p) => [p.id, p.basePrice]));

    const components = bundle.items.map((item) => ({
      basePrice: priceMap.get(item.productId) ?? 0,
      quantity: item.quantity,
    }));

    const calculatedPrice = this.calculateBundlePrice(
      components,
      bundle.discount,
    );

    return { ...bundle, calculatedPrice };
  }

  async remove(id: string) {
    return this.prisma.bundle.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
