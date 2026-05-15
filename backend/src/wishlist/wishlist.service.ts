import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_WISHLIST_ITEMS = 500;

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) { }

  async findAll(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: { where: { isMain: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForAdmin(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      select: {
        id: true,
        productId: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            salePrice: true,
            images: {
              where: { isMain: true },
              take: 1,
              select: {
                id: true,
                mediaFile: {
                  select: { id: true, card: true, thumb: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      throw new ConflictException('Product already in wishlist');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const count = await tx.wishlistItem.count({ where: { userId } });
        if (count >= MAX_WISHLIST_ITEMS) {
          throw new BadRequestException(
            `Wishlist full (maximum ${MAX_WISHLIST_ITEMS} items)`,
          );
        }
        return tx.wishlistItem.create({ data: { userId, productId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async remove(userId: string, productId: string) {
    return this.prisma.wishlistItem.delete({
      where: { userId_productId: { userId, productId } },
    });
  }
}
