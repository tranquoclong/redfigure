import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../email/email-queue.service';
import { parseEmailRecipients } from '../common/utils/email-recipients';

interface StockItem {
  productId: string;
  variationId?: string;
  quantity: number;
}

interface AdjustStockParams {
  productId: string;
  variationId?: string;
  delta: number;
  adminUserId: string;
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private prisma: PrismaService,
    private emailQueueService: EmailQueueService,
    private configService: ConfigService,
  ) { }

  private async resolveAdminRecipients(): Promise<string[]> {
    const row = await this.prisma.setting.findUnique({
      where: { key: 'low_stock_email_recipients' },
    } as any);
    const fromDb = parseEmailRecipients(row?.value ?? null);
    if (fromDb.length > 0) return fromDb;
    return parseEmailRecipients(this.configService.get<string>('ADMIN_EMAIL'));
  }

  async validateAvailability(items: StockItem[]): Promise<void> {
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product || !product.manageStock) continue;

      if (item.variationId) {
        const variation = await this.prisma.productVariation.findUnique({
          where: { id: item.variationId },
        });
        if (!variation || !variation.manageStock) continue;

        const available = variation.stock - variation.reservedStock;
        if (available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" (available: ${available}, requested: ${item.quantity})`,
          );
        }
      } else {
        const available = product.stock - product.reservedStock;
        if (available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" (available: ${available}, requested: ${item.quantity})`,
          );
        }
      }
    }
  }

  async reserveStock(
    orderId: string,
    items: StockItem[],
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      return this.executeReserve(tx, orderId, items);
    }
    return this.prisma.$transaction((inner) =>
      this.executeReserve(inner, orderId, items),
    );
  }

  private async executeReserve(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: StockItem[],
  ) {
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });
      if (!product || !product.manageStock) continue;

      if (item.variationId) {
        const variation = await tx.productVariation.findUnique({
          where: { id: item.variationId },
        });
        if (!variation || !variation.manageStock) continue;

        const available = variation.stock - variation.reservedStock;
        if (available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" (available: ${available}, requested: ${item.quantity})`,
          );
        }

        await tx.productVariation.update({
          where: { id: item.variationId },
          data: { reservedStock: { increment: item.quantity } },
        });

        await this.createAuditLog(tx, {
          productId: item.productId,
          variationId: item.variationId,
          quantityBefore: variation.stock,
          quantityAfter: variation.stock,
          delta: 0,
          reservedBefore: variation.reservedStock,
          reservedAfter: variation.reservedStock + item.quantity,
          reason: 'ORDER_RESERVED',
          referenceId: orderId,
        });
      } else {
        const available = product.stock - product.reservedStock;
        if (available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" (available: ${available}, requested: ${item.quantity})`,
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { reservedStock: { increment: item.quantity } },
        });

        await this.createAuditLog(tx, {
          productId: item.productId,
          quantityBefore: product.stock,
          quantityAfter: product.stock,
          delta: 0,
          reservedBefore: product.reservedStock,
          reservedAfter: product.reservedStock + item.quantity,
          reason: 'ORDER_RESERVED',
          referenceId: orderId,
        });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: { stockReserved: true },
    });
  }

  async confirmReservation(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order?.stockReserved) return;

      const items = await tx.orderItem.findMany({
        where: { orderId },
        include: { product: true },
      });

      for (const item of items) {

        if (!item.productId || !item.product || !item.product.manageStock)
          continue;

        if (item.variationId) {
          const variation = await tx.productVariation.findUnique({
            where: { id: item.variationId },
          });
          if (!variation) continue;

          await tx.productVariation.update({
            where: { id: item.variationId },
            data: {
              stock: { decrement: item.quantity },
              reservedStock: { decrement: item.quantity },
            },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            variationId: item.variationId,
            quantityBefore: variation.stock,
            quantityAfter: variation.stock - item.quantity,
            delta: -item.quantity,
            reservedBefore: variation.reservedStock,
            reservedAfter: variation.reservedStock - item.quantity,
            reason: 'ORDER_CONFIRMED',
            referenceId: orderId,
          });
        } else {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) continue;

          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              reservedStock: { decrement: item.quantity },
            },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            quantityBefore: product.stock,
            quantityAfter: product.stock - item.quantity,
            delta: -item.quantity,
            reservedBefore: product.reservedStock,
            reservedAfter: product.reservedStock - item.quantity,
            reason: 'ORDER_CONFIRMED',
            referenceId: orderId,
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { stockReserved: false },
      });
    });
  }

  async releaseStock(
    orderId: string,
    reason: 'ORDER_CANCELLED' | 'PAYMENT_FAILED',
  ) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order?.stockReserved) return;

      const items = await tx.orderItem.findMany({
        where: { orderId },
        include: { product: true },
      });

      for (const item of items) {

        if (!item.productId || !item.product || !item.product.manageStock)
          continue;

        if (item.variationId) {
          const variation = await tx.productVariation.findUnique({
            where: { id: item.variationId },
          });
          if (!variation) continue;

          await tx.productVariation.update({
            where: { id: item.variationId },
            data: { reservedStock: { decrement: item.quantity } },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            variationId: item.variationId,
            quantityBefore: variation.stock,
            quantityAfter: variation.stock,
            delta: 0,
            reservedBefore: variation.reservedStock,
            reservedAfter: variation.reservedStock - item.quantity,
            reason,
            referenceId: orderId,
          });
        } else {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) continue;

          await tx.product.update({
            where: { id: item.productId },
            data: { reservedStock: { decrement: item.quantity } },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            quantityBefore: product.stock,
            quantityAfter: product.stock,
            delta: 0,
            reservedBefore: product.reservedStock,
            reservedAfter: product.reservedStock - item.quantity,
            reason,
            referenceId: orderId,
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { stockReserved: false },
      });
    });
  }

  async adjustStock(params: AdjustStockParams) {
    await this.prisma.$transaction(async (tx) => {
      if (params.variationId) {
        const variation = await tx.productVariation.findUnique({
          where: { id: params.variationId },
        });
        if (!variation)
          throw new BadRequestException('Variation not found');

        const updated = await tx.productVariation.update({
          where: { id: params.variationId },
          data: { stock: { increment: params.delta } },
        });

        await this.createAuditLog(tx, {
          productId: params.productId,
          variationId: params.variationId,
          quantityBefore: variation.stock,
          quantityAfter: updated.stock,
          delta: params.delta,
          reason: 'ADMIN_ADJUSTMENT',
          referenceId: params.adminUserId,
        });
      } else {
        const product = await tx.product.findUnique({
          where: { id: params.productId },
        });
        if (!product) throw new BadRequestException('Product not found');

        const updated = await tx.product.update({
          where: { id: params.productId },
          data: { stock: { increment: params.delta } },
        });

        await this.createAuditLog(tx, {
          productId: params.productId,
          quantityBefore: product.stock,
          quantityAfter: updated.stock,
          delta: params.delta,
          reason: 'ADMIN_ADJUSTMENT',
          referenceId: params.adminUserId,
        });
      }
    });
  }

  getAvailableStock(stock: number, reservedStock: number): number {
    return Math.max(0, stock - reservedStock);
  }

  async getAuditLog(productId: string, variationId?: string) {
    return this.prisma.stockAuditLog.findMany({
      where: {
        productId,
        ...(variationId ? { variationId } : {}),
      },
      include: {
        variation: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async checkLowStock(productId: string, variationId?: string) {
    const product = (await this.prisma.product.findUnique({
      where: { id: productId },
    })) as any;
    if (!product?.manageStock) return;

    const globalSetting = await this.prisma.setting.findUnique({
      where: { key: 'low_stock_threshold' },
    } as any);
    const threshold =
      product.lowStockThreshold ?? parseInt(globalSetting?.value ?? '5', 10);

    let currentStock: number;
    let itemName = product.name;
    let variationName: string | undefined;

    if (variationId) {
      const variation = (await this.prisma.productVariation.findUnique({
        where: { id: variationId },
      })) as any;
      currentStock = variation?.stock ?? 0;
      variationName = variation?.name;
      itemName = `${product.name} - ${variationName ?? variationId}`;
    } else {
      currentStock = product.stock;
    }

    if (currentStock <= threshold) {
      this.logger.warn(
        `LOW STOCK: "${itemName}" — ${currentStock} units (threshold: ${threshold})`,
      );

      const recipients = await this.resolveAdminRecipients();
      if (recipients.length > 0) {
        try {
          await this.emailQueueService.enqueueLowStockAlert({
            to: recipients.join(', '),
            productName: itemName,
            currentStock,
            threshold,
            ...(variationName ? { variationName } : {}),
          });
        } catch (err) {
          this.logger.error(`Failed to enqueue low stock alert: ${err}`);
        }
      }

      return { isLow: true, currentStock, threshold, productName: itemName };
    }

    return { isLow: false, currentStock, threshold };
  }

  async findLowStockProducts(page = 1, perPage = 20) {
    const globalSetting = await this.prisma.setting.findUnique({
      where: { key: 'low_stock_threshold' },
    } as any);
    const globalThreshold = parseInt(globalSetting?.value ?? '5', 10);

    const products = await this.prisma.product.findMany({
      where: {
        manageStock: true,
        isActive: true,
        type: 'simple',
      },
      include: { productCategories: { include: { category: true } } },
      orderBy: { stock: 'asc' },
    });

    const lowStock = products.filter((p: any) => {
      const threshold = p.lowStockThreshold ?? globalThreshold;
      return p.stock <= threshold;
    });

    const start = (page - 1) * perPage;
    const paginated = lowStock.slice(start, start + perPage);

    const variations = await this.prisma.productVariation.findMany({
      where: {
        deletedAt: null,
        product: { manageStock: true, isActive: true, type: 'variable' },
      },
      include: { product: true },
      orderBy: { stock: 'asc' },
    });

    const lowStockVariations = variations.filter((v: any) => {
      const threshold = v.product.lowStockThreshold ?? globalThreshold;
      return v.stock <= threshold;
    });

    return {
      products: paginated.map((p: any) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        reservedStock: p.reservedStock,
        available: p.stock - p.reservedStock,
        threshold: p.lowStockThreshold ?? globalThreshold,
        category: p.productCategories?.[0]?.category?.name,
      })),
      variations: lowStockVariations
        .slice(start, start + perPage)
        .map((v: any) => ({
          id: v.id,
          productId: v.productId,
          productName: v.product.name,
          variationName: v.name,
          stock: v.stock,
          reservedStock: v.reservedStock,
          available: v.stock - v.reservedStock,
          threshold: v.product.lowStockThreshold ?? globalThreshold,
        })),
      total: lowStock.length + lowStockVariations.length,
    };
  }

  private async createAuditLog(
    tx: any,
    data: {
      productId: string;
      variationId?: string;
      quantityBefore: number;
      quantityAfter: number;
      delta: number;
      reservedBefore?: number;
      reservedAfter?: number;
      reason: string;
      referenceId?: string;
      note?: string;
    },
  ) {

    await tx.stockAuditLog.create({ data });
  }
}
