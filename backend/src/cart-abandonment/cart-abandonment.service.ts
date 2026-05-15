import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AbandonmentSettings,
  SettingsService,
} from '../settings/settings.service';
import { CouponsService } from '../coupons/coupons.service';
import { EmailQueueService } from '../email/email-queue.service';
import { UnsubscribeService } from '../users/unsubscribe.service';

interface CartItemSnapshot {
  productId?: string;
  variationId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

type CartWithUser = Prisma.CartGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        name: true;
        emailMarketingOptOut: true;
      };
    };
  };
}>;

const BATCH_SIZE = 500;

const ABANDONMENT_JOB_RETENTION_SEC = 90_000;

@Injectable()
export class CartAbandonmentService {
  private readonly logger = new Logger(CartAbandonmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly coupons: CouponsService,
    private readonly emailQueue: EmailQueueService,
    private readonly unsubscribe: UnsubscribeService,
  ) { }

  private get storeUrl(): string {
    return process.env.FRONTEND_URL ?? 'https://redfigure.com';
  }

  async processAbandonedCarts(): Promise<{
    firstSent: number;
    secondSent: number;
    skipped: number;
  }> {
    const cfg = await this.settings.getAbandonmentSettings();
    const now = new Date();

    let firstSent = 0;
    let secondSent = 0;
    let skipped = 0;

    if (cfg.firstEnabled) {
      const firstResult = await this.processFirstReminders(cfg, now);
      firstSent = firstResult.sent;
      skipped += firstResult.skipped;
    }

    if (cfg.secondEnabled && this.isCouponConfigured(cfg)) {
      const secondResult = await this.processSecondReminders(cfg, now);
      secondSent = secondResult.sent;
      skipped += secondResult.skipped;
    } else if (cfg.secondEnabled) {
      this.logger.warn(
        '2nd email enabled but coupon is not fully configured ' +
        '(couponType/couponValue/couponValidityHours) - skip dispatch',
      );
    }

    return { firstSent, secondSent, skipped };
  }

  private isCouponConfigured(cfg: AbandonmentSettings): boolean {
    return (
      cfg.couponType !== null &&
      cfg.couponValue !== null &&
      cfg.couponValidityHours !== null
    );
  }

  private async processFirstReminders(
    cfg: AbandonmentSettings,
    now: Date,
  ): Promise<{ sent: number; skipped: number }> {
    const cutoff = new Date(now.getTime() - cfg.firstDelayHours * 3_600_000);
    const carts = (await this.prisma.cart.findMany({
      where: {
        reminderSentAt: null,
        updatedAt: { lt: cutoff },
        userId: { not: null as unknown as string },

        user: { emailMarketingOptOut: false },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailMarketingOptOut: true,
          },
        },
      },
      take: BATCH_SIZE,
    })) as CartWithUser[];

    let sent = 0;
    let skipped = 0;

    for (const cart of carts) {
      const items = this.normalizeItems(cart.items);
      if (items.length === 0 || !cart.userId || !cart.user?.email) {

        const updZ = await this.prisma.cart.updateMany({
          where: { id: cart.id, updatedAt: cart.updatedAt },
          data: { reminderSentAt: now, secondReminderSentAt: now },
        });
        if (updZ.count > 0) skipped++;
        continue;
      }

      const total = this.calcTotal(items);

      const cycleKey = new Date(cart.updatedAt).getTime();
      const jobId = `abandon-1-${cart.id}-${cycleKey}`;

      const upd = await this.prisma.cart.updateMany({
        where: { id: cart.id, updatedAt: cart.updatedAt },
        data: { reminderSentAt: now },
      });
      if (upd.count === 0) {
        this.logger.warn(
          `cart ${cart.id} modified during 1st reminder — OCC blocked send`,
        );
        skipped++;
        continue;
      }

      try {
        await this.emailQueue.enqueueCartAbandonmentFirst(
          {
            to: cart.user.email,
            customerName: cart.user.name ?? 'Client',
            items: items.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              price: i.unitPrice,
            })),
            total,
            cartUrl: `${this.storeUrl}/cart`,
            unsubscribeUrl: await this.unsubscribe.buildUrl(cart.userId),
            unsubscribeOneClickUrl: await this.unsubscribe.buildOneClickUrl(
              cart.userId,
            ),
            cartId: cart.id,
            cycleKey,
          },
          {
            jobId,
            removeOnComplete: { age: ABANDONMENT_JOB_RETENTION_SEC },
            removeOnFail: { age: ABANDONMENT_JOB_RETENTION_SEC },
          },
        );
        sent++;
      } catch (err) {
        this.logger.error(
          `enqueue 1st failed (cart=${cart.id}), roll back DB: ${this.errMsg(err)}`,
        );

        try {
          await this.prisma.cart.updateMany({
            where: { id: cart.id, reminderSentAt: now },
            data: { reminderSentAt: null },
          });
        } catch (rbErr) {

          this.logger.error(
            `CRITICAL: rollback of 1st failed (cart=${cart.id}): ${this.errMsg(rbErr)}`,
          );
          Sentry.captureException(rbErr, {
            tags: { cart_abandonment: 'rollback_failed', stage: 'first' },
            extra: { cartId: cart.id, jobId },
            level: 'error',
          });
        }
        skipped++;
      }
    }

    return { sent, skipped };
  }

  private async processSecondReminders(
    cfg: AbandonmentSettings,
    now: Date,
  ): Promise<{ sent: number; skipped: number }> {
    const cutoff = new Date(now.getTime() - cfg.secondDelayHours * 3_600_000);
    const carts = (await this.prisma.cart.findMany({
      where: {
        secondReminderSentAt: null,
        reminderSentAt: { lt: cutoff, not: null },
        user: { emailMarketingOptOut: false },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailMarketingOptOut: true,
          },
        },
      },
      take: BATCH_SIZE,
    })) as CartWithUser[];

    let sent = 0;
    let skipped = 0;

    for (const cart of carts) {
      const items = this.normalizeItems(cart.items);
      if (items.length === 0 || !cart.userId || !cart.user?.email) {

        const updZ = await this.prisma.cart.updateMany({
          where: { id: cart.id, updatedAt: cart.updatedAt },
          data: { secondReminderSentAt: now },
        });
        if (updZ.count > 0) skipped++;
        continue;
      }

      const validUntil = new Date(
        now.getTime() + cfg.couponValidityHours! * 3_600_000,
      );
      const total = this.calcTotal(items);
      const cycleKey = new Date(cart.updatedAt).getTime();
      const jobId = `abandon-2-${cart.id}-${cycleKey}`;

      const upd = await this.prisma.cart.updateMany({
        where: { id: cart.id, updatedAt: cart.updatedAt },
        data: { secondReminderSentAt: now },
      });
      if (upd.count === 0) {
        this.logger.warn(
          `cart ${cart.id} modified during 2nd reminder — OCC blocked`,
        );
        skipped++;
        continue;
      }

      let coupon: { code: string };
      try {
        coupon = await this.coupons.createAbandonmentReward({
          userId: cart.userId,
          type: cfg.couponType!,
          value: cfg.couponValue!,
          validUntil,
          minOrderValue: cfg.couponMinOrderValue,
        });
      } catch (err) {
        this.logger.error(
          `Creating coupon failed (cart=${cart.id}), rollback DB: ${this.errMsg(err)}`,
        );
        try {
          await this.prisma.cart.updateMany({
            where: { id: cart.id, secondReminderSentAt: now },
            data: { secondReminderSentAt: null },
          });
        } catch (rbErr) {
          this.logger.error(
            `CRITICAL: rollback pos-coupon failed (cart=${cart.id}): ${this.errMsg(rbErr)}`,
          );
          Sentry.captureException(rbErr, {
            tags: {
              cart_abandonment: 'rollback_failed',
              stage: 'second_coupon',
            },
            extra: { cartId: cart.id },
            level: 'error',
          });
        }
        skipped++;
        continue;
      }

      try {
        await this.emailQueue.enqueueCartAbandonmentSecond(
          {
            to: cart.user.email,
            customerName: cart.user.name ?? 'Client',
            items: items.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              price: i.unitPrice,
            })),
            total,
            cartUrl: `${this.storeUrl}/cart`,
            unsubscribeUrl: await this.unsubscribe.buildUrl(cart.userId),
            unsubscribeOneClickUrl: await this.unsubscribe.buildOneClickUrl(
              cart.userId,
            ),
            couponCode: coupon.code,
            couponLabel: this.formatCouponLabel(
              cfg.couponType!,
              cfg.couponValue!,
            ),
            couponValidUntil: validUntil,
            cartId: cart.id,
            cycleKey,
          },
          {
            jobId,
            removeOnComplete: { age: ABANDONMENT_JOB_RETENTION_SEC },
            removeOnFail: { age: ABANDONMENT_JOB_RETENTION_SEC },
          },
        );
        sent++;
      } catch (err) {
        this.logger.error(
          `enqueue 2nd failed (cart=${cart.id}), rollback: ${this.errMsg(err)}`,
        );

        try {
          await this.prisma.cart.updateMany({
            where: { id: cart.id, secondReminderSentAt: now },
            data: { secondReminderSentAt: null },
          });
        } catch (rbErr) {
          this.logger.error(
            `CRITICAL: rollback of 2nd failed (cart=${cart.id}): ${this.errMsg(rbErr)}`,
          );
          Sentry.captureException(rbErr, {
            tags: { cart_abandonment: 'rollback_failed', stage: 'second' },
            extra: { cartId: cart.id, jobId, couponId: coupon.code },
            level: 'error',
          });
        }
        skipped++;
      }
    }

    return { sent, skipped };
  }

  private normalizeItems(items: unknown): CartItemSnapshot[] {
    if (!Array.isArray(items)) return [];
    return items.filter(
      (i): i is CartItemSnapshot =>
        i &&
        typeof i === 'object' &&
        typeof (i as { name?: unknown }).name === 'string' &&
        typeof (i as { quantity?: unknown }).quantity === 'number' &&
        typeof (i as { unitPrice?: unknown }).unitPrice === 'number',
    );
  }

  private calcTotal(items: CartItemSnapshot[]): number {

    return (
      Math.round(
        items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) * 100,
      ) / 100
    );
  }

  private formatCouponLabel(
    type: 'PERCENTAGE' | 'FIXED',
    value: number,
  ): string {
    if (type === 'PERCENTAGE') return `${value}%`;
    return `${value.toLocaleString('vi-VN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} VND`;
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
