import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StockService } from '../stock/stock.service';
import { PricingService } from '../pricing/pricing.service';
import { VerifiedItem } from '../pricing/pricing.types';
import { OrderExpirationService } from './order-expiration.service';
import { EmailQueueService } from '../email/email-queue.service';
import { ReviewInvitesService } from '../review-invites/review-invites.service';
import { AffiliateLedgerService } from '../affiliates/affiliate-ledger.service';
import { MetricsService } from '../metrics/metrics.service';
// import { CheckoutLogService } from '../payments/checkout-log.service';

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

export interface ShippingAddressSnapshot {
  recipient: string;
  postalCode?: string;
  street: string;
  ward: string;
  district: string;
  province: string;
  country?: string;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const ACTIVE_STOCK_STATES = new Set([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
]);

const CONFIRM_STOCK_STATES = new Set([
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
]);

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private stockService: StockService,
    private pricingService: PricingService,
    @Inject(forwardRef(() => OrderExpirationService))
    private orderExpirationService: OrderExpirationService,
    private emailQueueService: EmailQueueService,
    private reviewInvitesService: ReviewInvitesService,
    private affiliateLedgerService: AffiliateLedgerService,
    private metricsService: MetricsService,
    // private checkoutLog: CheckoutLogService,
  ) { }

  isValidTransition(from: string, to: string): boolean {
    return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
  }

  private async generateOrderNumber(): Promise<string> {

    for (let attempt = 0; attempt < 10; attempt++) {

      const bytes = attempt < 5 ? 9 : 12;
      const num = randomBytes(bytes).toString('hex').toUpperCase();
      const exists = await this.prisma.order.findUnique({
        where: { number: num },
        select: { id: true },
      });
      if (!exists) return num;
    }
    throw new Error(
      'It was not possible to generate a unique order number after 10 attempts.',
    );
  }

  private readonly MAX_GIFT_ITEMS_PER_ORDER = 5;

  private async validateFreeGiftItems(
    tx: Prisma.TransactionClient,
    items: VerifiedItem[],
    subtotal: number,
  ): Promise<VerifiedItem[]> {
    const giftIndices: number[] = [];
    items.forEach((it, i) => {
      if (it.isFreeGift) giftIndices.push(i);
    });
    if (giftIndices.length === 0) return items;

    const invalid = new Set<number>();
    const now = new Date();
    let validKept = false;

    const freeGiftIds = Array.from(
      new Set(
        giftIndices
          .map(
            (i) =>
              (items[i] as VerifiedItem & { freeGiftId?: string }).freeGiftId,
          )
          .filter((id): id is string => !!id),
      ),
    );
    const gifts =
      freeGiftIds.length > 0
        ? await tx.freeGift.findMany({
          where: { id: { in: freeGiftIds } },
        })
        : [];
    const giftMap = new Map(gifts.map((g) => [g.id, g]));

    const indicesToProcess = giftIndices.slice(
      0,
      this.MAX_GIFT_ITEMS_PER_ORDER,
    );
    const indicesDropped = giftIndices.slice(this.MAX_GIFT_ITEMS_PER_ORDER);
    indicesDropped.forEach((i) => {
      invalid.add(i);
      this.metricsService.observeFreeGiftRejection('cap_exceeded');
    });
    if (indicesDropped.length > 0) {
      this.logger.warn(
        `FreeGift cap: ${indicesDropped.length} extra items dropped (>${this.MAX_GIFT_ITEMS_PER_ORDER})`,
      );
    }

    type RejectReason =
      | 'no_freegift_id'
      | 'inactive_or_missing'
      | 'before_window'
      | 'expired'
      | 'subtotal_insufficient'
      | 'product_mismatch'
      | 'non_zero_price'
      | 'quantity_invalid'
      | 'cap_exceeded'
      | 'out_of_stock';

    for (const i of indicesToProcess) {
      const item = items[i];
      const itemWithFg = item as VerifiedItem & { freeGiftId?: string };
      const freeGiftId = itemWithFg.freeGiftId;

      const sanitizeLog = (s: string | undefined): string =>

        (s ?? '').replace(/[\x00-\x1F\x7F-\x9F]+/g, ' ').slice(0, 200);
      const safeFreeGiftId = sanitizeLog(freeGiftId);
      const safeProductId = sanitizeLog(item.productId);

      const reject = (reason: RejectReason, detail?: string): void => {
        const safeDetail = sanitizeLog(detail);
        this.logger.warn(
          `FreeGift removed — ${reason}${safeDetail ? ` (${safeDetail})` : ''} (freeGiftId=${safeFreeGiftId || 'null'}, productId=${safeProductId})`,
        );

        this.metricsService.observeFreeGiftRejection(reason);
        invalid.add(i);
      };

      if (!freeGiftId) {
        reject('no_freegift_id');
        continue;
      }

      const gift = giftMap.get(freeGiftId);
      if (!gift || !gift.isActive) {
        reject('inactive_or_missing');
        continue;
      }
      if (gift.startsAt && now < gift.startsAt) {
        reject('before_window');
        continue;
      }
      if (gift.endsAt && now > gift.endsAt) {
        reject('expired');
        continue;
      }
      if (subtotal < gift.minOrderAmount) {
        reject('subtotal_insufficient', `${subtotal} < ${gift.minOrderAmount}`);
        continue;
      }
      if (gift.productId !== item.productId) {
        reject(
          'product_mismatch',
          `gift=${gift.productId} item=${item.productId}`,
        );
        continue;
      }
      if (item.unitPrice !== 0 || item.lineTotal !== 0) {
        reject('non_zero_price');
        continue;
      }

      if (item.quantity !== 1) {
        reject('quantity_invalid');
        continue;
      }

      if (validKept) {
        reject('cap_exceeded');
        continue;
      }

      const productMeta = await tx.product.findUnique({
        where: { id: gift.productId },
        select: { manageStock: true },
      });
      if (productMeta?.manageStock) {
        const reservedRows = await tx.$executeRaw`
          UPDATE products
          SET "reservedStock" = "reservedStock" + 1, "updatedAt" = NOW()
          WHERE id = ${gift.productId}
            AND "manageStock" = true
            AND ("stock" - "reservedStock") >= 1
        `;
        if (reservedRows === 0) {
          reject('out_of_stock');
          continue;
        }
      }

      validKept = true;
    }

    return items.filter((_, i) => !invalid.has(i));
  }

  async createOrder(params: {
    userId: string;
    userEmail?: string;
    idempotencyKey?: string;
    items: Array<{
      productId?: string;
      variationId?: string;
      scaleId?: string;
      quoteItemId?: string;
      freeGiftId?: string;
      quantity: number;
    }>;
    shipping?: number;
    shippingZipCode?: string;
    shippingAddress?: ShippingAddressSnapshot;
    shippingCarrier?: string;
    shippingServiceName?: string;
    shippingServiceId?: number;
    shippingDeadlineDays?: number;
    couponCodes?: string[];
    paymentMethod?: string;
    estimatedDeliveryDate?: string;

    referringAffiliateId?: string | null;
    referringSessionId?: string;
  }) {

    if (!params.userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    const lockKey = `order:lock:${params.userId}`;

    const lockValue = randomUUID();
    const lockAcquired = await this.redisService.setNX(lockKey, lockValue, 30);
    if (!lockAcquired) {
      throw new ConflictException(
        'Checkout in progress. Please wait for the current order to be finalized.',
      );
    }

    try {

      if (params.idempotencyKey) {
        const redisKey = `order:idempotency:${params.userId}:${params.idempotencyKey}`;
        const existingOrderId = await this.redisService.get(redisKey);
        if (existingOrderId) {
          this.logger.warn(
            `Idempotent hit: key=${params.idempotencyKey} user=${params.userId} → order=${existingOrderId}`,
          );

          const existing = await this.prisma.order.findFirst({
            where: { id: existingOrderId, userId: params.userId },
            include: { items: true },
          });
          if (existing) return existing;
        }
      }

      return await this.executeCreateOrder(params);
    } finally {

      try {
        await this.redisService.releaseLock(lockKey, lockValue);
      } catch (releaseErr) {
        this.logger.error(
          `Failed to release lock ${lockKey}: ${releaseErr instanceof Error
            ? releaseErr.message
            : String(releaseErr)
          }`,
        );
      }
    }
  }

  private async executeCreateOrder(params: {
    userId: string;
    userEmail?: string;
    idempotencyKey?: string;
    items: Array<{
      productId?: string;
      variationId?: string;
      scaleId?: string;
      quoteItemId?: string;
      freeGiftId?: string;
      quantity: number;
    }>;
    shipping?: number;
    shippingZipCode?: string;
    shippingAddress?: ShippingAddressSnapshot;
    shippingCarrier?: string;
    shippingServiceName?: string;
    shippingServiceId?: number;
    shippingDeadlineDays?: number;
    couponCodes?: string[];
    paymentMethod?: string;
    estimatedDeliveryDate?: string;
    referringAffiliateId?: string | null;
    referringSessionId?: string;
  }) {

    if (params.shippingServiceId != null) {
      if (!params.shippingServiceName) {
        throw new BadRequestException(
          'Shipping service name is required when ID is provided.',
        );
      }
      const method = await this.prisma.shippingMethod.findFirst({
        where: { serviceId: params.shippingServiceId, isActive: true },
      });
      if (!method) {
        throw new BadRequestException(
          'Invalid or inactive shipping service. Re-quote shipping and try again.',
        );
      }
      if (
        method.name !== params.shippingServiceName &&
        method.displayName !== params.shippingServiceName
      ) {
        throw new BadRequestException(
          'Shipping service inconsistent — name and ID do not match. Re-quote shipping and try again.',
        );
      }

      params.shippingServiceName = method.name;
    }

    const pricingStart = Date.now();
    const pricing = await this.pricingService.calculateOrderPricing({
      userId: params.userId,
      userEmail: params.userEmail,
      items: params.items.map((i) => ({
        productId: i.productId,
        variationId: i.variationId,
        scaleId: i.scaleId,
        quoteItemId: i.quoteItemId,
        quantity: i.quantity,

        ...(i.freeGiftId ? { isFreeGift: true, freeGiftId: i.freeGiftId } : {}),
      })),
      couponCodes: params.couponCodes,
      shippingAmount: params.shipping ?? 0,
      shippingZipCode: params.shippingZipCode,

      shippingServiceId: params.shippingServiceId,
      paymentMethod: params.paymentMethod,
    });

    // void this.checkoutLog.log({
    //   step: 'pricing_computed',
    //   status: 'success',
    //   userId: params.userId,
    //   method: params.paymentMethod,
    //   duration: Date.now() - pricingStart,
    //   metadata: {
    //     idempotencyKey: params.idempotencyKey,
    //     itemCount: pricing.items.length,
    //     subtotal: pricing.subtotal,
    //     couponDiscount: pricing.couponDiscount,
    //     shipping: pricing.shipping,
    //     paymentDiscount: pricing.paymentDiscount,
    //     total: pricing.total,
    //     appliedCoupons: pricing.appliedCoupons?.map((c) => ({
    //       couponId: c.couponId,
    //       type: c.type,
    //       discount: c.discount,
    //     })),
    //     freeGiftCount: pricing.items.filter((i) => i.isFreeGift).length,
    //   },
    // });

    const stockValidationItems: Array<{
      productId: string;
      variationId?: string;
      quantity: number;
    }> = [];

    for (const item of pricing.items) {

      if (item.isFreeGift) continue;
      if (item.bundleComponents?.length) {
        for (const comp of item.bundleComponents) {
          stockValidationItems.push({
            productId: comp.childProductId,
            variationId: comp.childVariationId,

            quantity: comp.quantity * item.quantity,
          });
        }
      } else if (item.productId) {

        stockValidationItems.push({
          productId: item.productId,
          variationId: item.variationId,
          quantity: item.quantity,
        });
      }
    }

    await this.stockService.validateAvailability(stockValidationItems);

    // void this.checkoutLog.log({
    //   step: 'stock_validated',
    //   status: 'success',
    //   userId: params.userId,
    //   metadata: {
    //     idempotencyKey: params.idempotencyKey,
    //     items: stockValidationItems,
    //   },
    // });

    const productIds = Array.from(
      new Set(
        pricing.items
          .map((i) => i.productId)
          .filter((id): id is string => !!id),
      ),
    );
    const productInclude = {
      brand: { select: { name: true } },
      productCategories: {
        where: { isPrimary: true },
        include: { category: { select: { name: true } } },
        take: 1,
      },
      images: {
        orderBy: { order: 'asc' as const },
        take: 1,
        include: { mediaFile: { select: { thumb: true, card: true } } },
      },
    } satisfies Prisma.ProductInclude;
    type ProductWithSnapshot = Prisma.ProductGetPayload<{
      include: typeof productInclude;
    }>;

    const [products, baseProductionDaysSetting] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: productInclude,
      }),
      this.prisma.setting.findUnique({
        where: { key: 'base_production_days' },
      }),
    ]);
    const productMap = new Map<string, ProductWithSnapshot>(
      products.map((p) => [p.id, p]),
    );

    const baseProductionDays = parseInt(
      baseProductionDaysSetting?.value ?? '3',
      10,
    );

    const totalDeadlineDays =

      baseProductionDays + (params.shippingDeadlineDays ?? 0);

    const stockItems: Array<{
      productId: string;
      variationId?: string;
      quantity: number;
    }> = [];
    for (const item of pricing.items) {
      if (item.isFreeGift) continue;
      if (item.bundleComponents?.length) {
        for (const comp of item.bundleComponents) {
          stockItems.push({
            productId: comp.childProductId,
            variationId: comp.childVariationId,

            quantity: comp.quantity * item.quantity,
          });
        }
      } else if (item.productId) {

        stockItems.push({
          productId: item.productId,
          variationId: item.variationId,
          quantity: item.quantity,
        });
      }
    }

    const orderNumber = await this.generateOrderNumber();

    let order;
    try {
      order = await this.prisma.$transaction(
        async (tx) => {

          const userSnapshot = await tx.user.findUnique({
            where: { id: params.userId },
            select: {
              name: true,
              email: true,
              cccd: true,
              phone: true,
              mst: true,
              companyName: true,
            },
          });
          console.log("userSnapshot", userSnapshot)
          const cccdDigits = userSnapshot?.cccd?.replace(/\D/g, '') ?? '';
          const mstDigits = userSnapshot?.mst?.replace(/\D/g, '') ?? '';
          const phoneDigits = userSnapshot?.phone?.replace(/\D/g, '') ?? '';
          const hasValidCccd = cccdDigits.length === 12;
          const hasValidMst = mstDigits.length === 14;
          const hasFiscalDoc = hasValidCccd || hasValidMst;

          const hasValidPhone =
            phoneDigits.length === 10 || phoneDigits.length === 11;
          if (!hasFiscalDoc || !hasValidPhone) {

            // await this.checkoutLog.log({
            //   step: 'order_validation_failed',
            //   status: 'error',
            //   userId: params.userId,
            //   metadata: {
            //     reason: !hasFiscalDoc ? 'missing_fiscal_doc' : 'invalid_phone',
            //     idempotencyKey: params.idempotencyKey,
            //     hasValidCccd,
            //     hasValidMst,
            //     hasValidPhone,
            //     cccdLen: cccdDigits.length,
            //     mstLen: mstDigits.length,
            //     phoneLen: phoneDigits.length,
            //   },
            // });
            throw new BadRequestException(
              !hasFiscalDoc
                ? 'CCCD (or Company MST) is required to finalize the order.' + userSnapshot?.cccd
                : 'A valid phone number is required to finalize the order.',
            );
          }

          const eligibilitySubtotal = Math.max(
            0,

            pricing.subtotal - pricing.couponDiscount,
          );
          pricing.items = await this.validateFreeGiftItems(
            tx as unknown as Prisma.TransactionClient,
            pricing.items,
            eligibilitySubtotal,
          );

          const created = await tx.order.create({
            data: {
              number: orderNumber,
              userId: params.userId,
              idempotencyKey: params.idempotencyKey,
              status: 'PENDING',
              customerName: userSnapshot?.name ?? null,
              customerEmail: userSnapshot?.email ?? null,
              customerCccd: userSnapshot?.cccd ?? null,
              customerPhone: userSnapshot?.phone ?? null,
              customerMst: userSnapshot?.mst ?? null,
              customerCompanyName: userSnapshot?.companyName ?? null,
              subtotal: pricing.subtotal,
              shipping: pricing.shipping,
              discount: pricing.couponDiscount,
              total: pricing.total,
              shippingAddress: params.shippingAddress
                ? (params.shippingAddress as unknown as Prisma.InputJsonValue)
                : undefined,
              shippingCarrier: params.shippingCarrier,
              shippingServiceName: params.shippingServiceName,
              shippingServiceId: params.shippingServiceId,
              shippingDeadlineDays: totalDeadlineDays || undefined,

              ...(pricing.appliedCoupons && pricing.appliedCoupons.length > 0
                ? {
                  coupons: {
                    create: pricing.appliedCoupons.map((c, idx) => ({
                      couponId: c.couponId,
                      discount: c.discount,
                      couponType: c.type,
                      position: idx,
                    })),
                  },
                }
                : {}),

              referringAffiliateId: params.referringAffiliateId ?? null,
              referringAffiliateSource: params.referringAffiliateId
                ? 'REFERRAL_COOKIE'
                : null,
              paymentMethod: params.paymentMethod,
              estimatedDeliveryDate: totalDeadlineDays
                ? addBusinessDays(new Date(), totalDeadlineDays)
                : params.estimatedDeliveryDate
                  ? new Date(params.estimatedDeliveryDate)
                  : undefined,
              items: {
                create: pricing.items.map((item) => {

                  if (item.quoteItemId) {
                    return {
                      productId: null,
                      quoteItemId: item.quoteItemId,
                      quantity: item.quantity,
                      price: item.unitPrice,
                      productName: item.customItemName ?? null,
                      customItemDescription: item.customItemDescription ?? null,
                    };
                  }

                  const product = item.productId
                    ? productMap.get(item.productId)
                    : undefined;
                  const image = product?.images?.[0];
                  const productImage =
                    image?.mediaFile?.thumb ??
                    image?.mediaFile?.card ??
                    (image as { url?: string } | undefined)?.url ??
                    null;
                  return {
                    productId: item.productId,
                    variationId: item.variationId,
                    quantity: item.quantity,
                    price: item.unitPrice,
                    productName: product?.name ?? null,
                    productSku: product?.sku ?? null,
                    productImage,
                    productBrandName: product?.brand?.name ?? null,
                    productCategoryName:
                      product?.productCategories?.[0]?.category?.name ?? null,
                    variationLabel: item.variationLabel,
                    variationName: item.variationName,
                    scaleName: item.scaleName,
                    scalePercentage: item.scalePercentage || undefined,
                    bundleDiscount: item.bundleDiscount,
                    isFreeGift: item.isFreeGift ?? false,
                  };
                }),
              },
            },
            include: { items: true },
          });

          const bundleChildRows: Prisma.OrderItemCreateManyInput[] = [];
          for (const item of pricing.items) {
            if (item.bundleComponents?.length) {
              const parentOrderItem = created.items.find(
                (oi: { productId: string | null }) =>
                  oi.productId === item.productId,
              );
              if (parentOrderItem) {
                for (const comp of item.bundleComponents) {
                  bundleChildRows.push({
                    orderId: created.id,
                    parentOrderItemId: parentOrderItem.id,
                    productId: comp.childProductId,
                    variationId: comp.childVariationId,

                    quantity: comp.quantity * item.quantity,
                    price: comp.discountedPrice,
                    productName: comp.productName,
                    productImage: comp.productImage,
                    bundleDiscount: item.bundleDiscount,
                  });
                }
              }
            }
          }
          if (bundleChildRows.length > 0) {
            await tx.orderItem.createMany({ data: bundleChildRows });
          }

          await this.stockService.reserveStock(created.id, stockItems, tx);

          const quoteItemIds = pricing.items
            .map((i) => i.quoteItemId)
            .filter((id): id is string => !!id);
          if (quoteItemIds.length > 0) {

            for (const qid of quoteItemIds) {
              const locked: Array<{ id: string; status: string }> =
                await tx.$queryRaw`
                SELECT id, status FROM custom_quote_items
                WHERE id = ${qid}
                FOR UPDATE
              `;
              if (!locked.length || locked[0].status !== 'QUOTED') {
                throw new ConflictException(
                  'Budget item is no longer available',
                );
              }
            }

            await tx.customQuoteItem.updateMany({
              where: { id: { in: quoteItemIds } },
              data: { status: 'ACCEPTED' },
            });

            const quoteIds = new Set<string>();
            const justAcceptedItems = await tx.customQuoteItem.findMany({
              where: { id: { in: quoteItemIds } },
              select: { quoteId: true },
            });
            justAcceptedItems.forEach((i) => quoteIds.add(i.quoteId));

            for (const quoteId of quoteIds) {
              const counts = await tx.customQuoteItem.groupBy({
                by: ['status'],
                where: { quoteId },
                _count: true,
              });
              const total = counts.reduce(
                (sum, c) => sum + (c._count as unknown as number),
                0,
              );
              const quotedCount =
                counts.find((c) => c.status === 'QUOTED')?._count ?? 0;
              const newStatus =
                quotedCount === 0 ? 'FULLY_ACCEPTED' : 'PARTIALLY_ACCEPTED';
              await tx.customQuote.update({
                where: { id: quoteId },
                data: {
                  status: newStatus,
                  acceptedAt: new Date(),
                },
              });
              void total;
            }
          }

          if (pricing.appliedCoupons && pricing.appliedCoupons.length > 0) {

            try {
              await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
            } catch {

            }

            const sortedCoupons = [...pricing.appliedCoupons].sort((a, b) =>
              a.couponId.localeCompare(b.couponId),
            );
            for (const applied of sortedCoupons) {
              try {
                await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${applied.couponId} FOR UPDATE`;
              } catch (err: unknown) {
                const e = err as { code?: string; message?: string };
                if (
                  e.code === '55P03' ||
                  (e.message ?? '').toLowerCase().includes('lock')
                ) {
                  throw new ConflictException(
                    'Coupon in high demand. Please try again in a few moments.',
                  );
                }
                throw err;
              }

              const coupon = await tx.coupon.findUnique({
                where: { id: applied.couponId },
                include: { _count: { select: { usages: true } } },
              });
              if (coupon?.maxUses && coupon._count.usages >= coupon.maxUses) {
                throw new BadRequestException(
                  `Coupon ${applied.code} has reached its usage limit.`,
                );
              }
              if (coupon?.usesPerUser) {
                const userUsages = await tx.couponUsage.count({
                  where: {
                    couponId: applied.couponId,
                    userId: params.userId,
                  },
                });
                if (userUsages >= coupon.usesPerUser) {
                  throw new BadRequestException(
                    `You have already used the coupon ${applied.code}`,
                  );
                }
              }
              await tx.couponUsage.create({
                data: {
                  couponId: applied.couponId,
                  userId: params.userId,
                  orderId: created.id,
                },
              });
            }
          }

          return created;
        },
        { timeout: 5_000, maxWait: 2_000 },
      );
    } catch (err: unknown) {

      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {

        const target = err.meta?.target;
        const isIdempotencyHit =
          (Array.isArray(target) && target.includes('idempotencyKey')) ||
          (typeof target === 'string' && target.includes('idempotencyKey'));
        if (isIdempotencyHit) {
          const existing = await this.prisma.order.findFirst({
            where: {
              userId: params.userId,
              idempotencyKey: params.idempotencyKey,
            },
            include: { items: true },
          });
          if (existing) {
            this.logger.warn(
              `DB idempotency hit: user=${params.userId} key=${params.idempotencyKey} → order=${existing.id}`,
            );
            return existing;
          }
        }
      }
      throw err;
    }

    if (params.idempotencyKey) {

      await this.redisService.set(
        `order:idempotency:${params.userId}:${params.idempotencyKey}`,
        order.id,
        86400,
      );
    }
    if (params.paymentMethod) {
      await this.orderExpirationService.scheduleExpiration(
        order.id,
        params.paymentMethod,
      );
    }

    // void this.checkoutLog.log({
    //   step: 'order_persisted',
    //   status: 'success',
    //   orderId: order.id,
    //   userId: params.userId,
    //   method: params.paymentMethod,
    //   metadata: {
    //     idempotencyKey: params.idempotencyKey,
    //     orderNumber: (order as { number?: string }).number,
    //     total: pricing.total,
    //     appliedCoupons: pricing.appliedCoupons?.map((c) => c.couponId),
    //     stockItemCount: stockItems.length,
    //     freeGiftItems: pricing.items
    //       .filter((i) => i.isFreeGift)
    //       .map((i) => ({ productId: i.productId, freeGiftId: i.freeGiftId })),
    //     referringAffiliateId: params.referringAffiliateId,
    //     shippingCarrier: params.shippingCarrier,
    //     shippingServiceName: params.shippingServiceName,
    //     shippingServiceId: params.shippingServiceId,
    //   },
    // });

    return order;
  }

  async updateStatus(
    orderId: string,
    newStatus: string,
    userId?: string,
    reason?: string,
    acknowledgeRefundRequired = false,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const prev = order.status;

    if (prev === newStatus) {
      return order;
    }

    if (newStatus === 'CANCELLED' && !acknowledgeRefundRequired) {
      const approvedPayment = await this.prisma.payment.findFirst({
        where: { orderId, status: 'APPROVED' },
      });
      if (approvedPayment) {
        throw new BadRequestException(
          'This order has an APPROVED payment. ' +
          'Send acknowledgeRefundRequired=true to confirm that you ' +
          'will manually refund the payment in the gateway panel.',
        );
      }
    }

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: prev,
        toStatus: newStatus,
        createdBy: userId,
      },
    });

    // void this.checkoutLog.log({
    //   step: 'status_transition',
    //   status: 'success',
    //   orderId,
    //   userId,
    //   metadata: {
    //     fromStatus: prev,
    //     toStatus: newStatus,
    //     reason: reason ?? null,
    //     acknowledgeRefundRequired,
    //   },
    // });

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus as any,
        ...(newStatus === 'DELIVERED' && !(order as any).deliveredAt
          ? { deliveredAt: new Date() }
          : {}),
      },
    });

    if (newStatus === 'DELIVERED' && prev !== 'DELIVERED') {
      try {
        await this.reviewInvitesService.createForOrder(orderId);
      } catch (err) {
        this.logger.error(
          `Failed to create review invite for ${orderId}: ${err}`,
        );
      }
    }

    const wasActive = ACTIVE_STOCK_STATES.has(prev);
    const isActive = ACTIVE_STOCK_STATES.has(newStatus);

    if (!wasActive && isActive) {

      const items = await this.prisma.orderItem.findMany({
        where: { orderId },
        select: { productId: true, variationId: true, quantity: true },
      });
      await this.stockService.reserveStock(
        orderId,

        items
          .filter(
            (
              i,
            ): i is {
              productId: string;
              variationId: string | null;
              quantity: number;
            } => i.productId !== null,
          )
          .map((i) => ({
            productId: i.productId,
            variationId: i.variationId ?? undefined,
            quantity: i.quantity,
          })),
      );
    } else if (wasActive && !isActive) {
      await this.stockService.releaseStock(orderId, 'ORDER_CANCELLED');

      await this.prisma.couponUsage.deleteMany({
        where: { orderId },
      });
    }

    const wasConfirmed = CONFIRM_STOCK_STATES.has(prev);
    const isConfirmed = CONFIRM_STOCK_STATES.has(newStatus);
    if (wasConfirmed !== isConfirmed) {
      const items = await this.prisma.orderItem.findMany({
        where: { orderId, productId: { not: null } },
        select: { productId: true, quantity: true },
      });
      if (items.length > 0) {

        const totals = new Map<string, number>();
        for (const i of items) {
          const qty = Math.max(0, i.quantity);
          if (qty === 0) continue;
          totals.set(i.productId!, (totals.get(i.productId!) ?? 0) + qty);
        }
        if (totals.size > 0) {

          const sorted = [...totals.entries()].sort(([a], [b]) =>
            a.localeCompare(b),
          );
          const op = isConfirmed ? 'increment' : 'decrement';
          await this.prisma.$transaction(
            sorted.map(([productId, qty]) =>
              this.prisma.product.update({
                where: { id: productId },
                data: { salesCount: { [op]: qty } },
              }),
            ),
          );
        }
      }
    }

    if (!wasActive && isActive) {
      await this.prisma.$transaction(async (tx) => {
        const orderCoupons = await tx.orderCoupon.findMany({
          where: { orderId },
          select: { couponId: true },
        });

        const sortedCoupons = [...orderCoupons].sort((a, b) =>
          a.couponId.localeCompare(b.couponId),
        );
        try {
          await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
        } catch {

        }
        for (const oc of sortedCoupons) {
          try {
            await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${oc.couponId} FOR UPDATE`;
          } catch (err: unknown) {
            const e = err as { code?: string; message?: string };
            if (
              e.code === '55P03' ||
              (e.message ?? '').toLowerCase().includes('lock')
            ) {
              throw new ConflictException(
                'Coupon in high demand. Please try again in a few moments.',
              );
            }
            throw err;
          }
          const coupon = await tx.coupon.findUnique({
            where: { id: oc.couponId },
            include: { _count: { select: { usages: true } } },
          });
          if (!coupon) continue;
          if (coupon.maxUses && coupon._count.usages >= coupon.maxUses) {
            throw new BadRequestException(
              `Coupon ${coupon.code} is sold out during cancellation — the order cannot be restored without reapplying coupons.`,
            );
          }
          if (coupon.usesPerUser) {
            const userUsages = await tx.couponUsage.count({
              where: { couponId: oc.couponId, userId: order.userId },
            });
            if (userUsages >= coupon.usesPerUser) {
              throw new BadRequestException(
                `User limit reached for coupon ${coupon.code}.`,
              );
            }
          }
          const exists = await tx.couponUsage.findFirst({
            where: { couponId: oc.couponId, orderId },
          });
          if (!exists) {
            await tx.couponUsage.create({
              data: { couponId: oc.couponId, userId: order.userId, orderId },
            });
          }
        }
      });
    }

    if (CONFIRM_STOCK_STATES.has(newStatus)) {
      await this.stockService.confirmReservation(orderId);
    }

    if (order.customerEmail) {
      const base = {
        to: order.customerEmail,
        customerName: order.customerName ?? 'Client',
        orderNumber: order.number,
        orderId: order.id,
      };
      let emailJob: { id?: string; name?: string } | null = null;
      let emailError: unknown = null;
      try {
        switch (newStatus) {
          case 'PROCESSING':
            emailJob =
              await this.emailQueueService.enqueueOrderInProduction(base);
            break;
          case 'SHIPPED':
            emailJob = await this.emailQueueService.enqueueOrderShipped({
              ...base,
              trackingCode: order.trackingCode ?? undefined,
              trackingUrl: (order as any).trackingUrl ?? undefined,
              carrier: (order as any).shippingCarrier ?? undefined,
              deliveryDays: (order as any).shippingDeadlineDays ?? undefined,
            });
            break;
          case 'DELIVERED':
            emailJob = await this.emailQueueService.enqueueOrderDelivered(base);
            break;
          case 'CANCELLED':
            emailJob = await this.emailQueueService.enqueueOrderCancelled({
              ...base,
              reason,
            });
            break;
          case 'RETURNED':
            emailJob = await this.emailQueueService.enqueueOrderRefunded({
              ...base,
              reason,
            });
            break;
          default:

            break;
        }
      } catch (err) {
        emailError = err;

      }

      // if (emailJob || emailError) {
      //   void this.checkoutLog.log({
      //     step: 'email_enqueued',
      //     status: emailError ? 'error' : 'success',
      //     orderId,
      //     userId,
      //     error: emailError ?? undefined,
      //     metadata: {
      //       template: newStatus,
      //       jobId: emailJob?.id,
      //       jobName: emailJob?.name,
      //       to: order.customerEmail,
      //     },
      //   });
      // }
    }

    if (newStatus === 'CANCELLED') {
      try {
        await this.affiliateLedgerService.cancelPendingCommissionsForOrder(
          orderId,
        );
      } catch (err) {
        this.logger.error(
          `Failed to cancel PENDING commissions for order ${orderId}: ${err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return updated;
  }

  async findAll(params: {
    page: number;
    perPage: number;
    userId?: string;
    status?: string;
    search?: string;
  }) {
    const { page, perPage, userId, status, search } = params;
    const skip = (page - 1) * perPage;

    const where: Record<string, any> = { deletedAt: null };
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { number: { contains: search } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async findAllTrashed(params: { page: number; perPage: number }) {
    const { page, perPage } = params;
    const skip = (page - 1) * perPage;

    const where = { deletedAt: { not: null } };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip,
        take: perPage,
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async findById(id: string, user?: { id: string; role: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, variation: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        payments: {
          include: {
            events: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order || order.deletedAt) {
      throw new NotFoundException('Order not found');
    }

    if (user && user.role !== 'ADMIN' && order.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    return order;
  }

  async softDelete(id: string, _requesterId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order || order.deletedAt) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING' && order.status !== 'CANCELLED') {
      throw new BadRequestException(
        'Only PENDING or CANCELLED orders can be sent to the trash',
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order || !order.deletedAt) {
      throw new NotFoundException('Order not found in trash');
    }

    return this.prisma.order.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async trackByNumber(orderNumber: string, email: string) {

    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber },
      select: {
        number: true,
        status: true,
        trackingCode: true,
        createdAt: true,
        customerEmail: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const normalizedInput = email.trim().toLowerCase();
    const normalizedStored = (order.customerEmail ?? '').trim().toLowerCase();
    if (!normalizedStored || normalizedInput !== normalizedStored) {

      throw new NotFoundException('Order not found');
    }

    const { customerEmail: _unused, ...safe } = order;
    return safe;
  }
}
