import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeOrderWhere = {
      createdAt: { gte: startOfMonth },
      deletedAt: null,
      status: { notIn: ['PENDING', 'CANCELLED'] as any },
    };

    const allMonthWhere = {
      createdAt: { gte: startOfMonth },
      deletedAt: null,
    };

    const [totalOrders, revenueResult, totalUsers, totalProducts] =
      await Promise.all([
        this.prisma.order.count({ where: allMonthWhere }),
        this.prisma.order.aggregate({
          where: activeOrderWhere,
          _sum: { subtotal: true, discount: true },
        }),
        this.prisma.user.count(),
        this.prisma.product.count({ where: { isActive: true } }),
      ]);

    const subtotalSum = revenueResult._sum?.subtotal ?? 0;
    const discountSum = revenueResult._sum?.discount ?? 0;

    const totalRevenue = Math.round((subtotalSum - discountSum) * 100) / 100;

    return {
      totalOrders,
      totalRevenue,
      totalUsers,
      totalProducts,
    };
  }

  async getOrdersByStatus() {

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: startOfMonth },
        deletedAt: null,
      },
      _count: { _all: true },
    });

    return grouped.map((g) => ({
      status: g.status,
      count: g._count._all,
    }));
  }
}
