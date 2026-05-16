import {
  Injectable,
  forwardRef,
  Inject,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';

const SETTING_KEYS: Record<string, string> = {
  sepay: 'sepay_expiration_minutes',
};

const DEFAULT_MINUTES: Record<string, number> = {
  sepay: 15,
};

const EXPIRATION_REASONS: Record<string, string> = {
  sepay: 'sepay payment not received within the deadline.',
};
const DEFAULT_EXPIRATION_REASON = 'Payment deadline expired';

@Injectable()
export class OrderExpirationService implements OnModuleDestroy {
  private readonly logger = new Logger(OrderExpirationService.name);
  private queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {
    this.queue = new Queue(
      'order-expiration',
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 500 },
        },
      }),
    );
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async scheduleExpiration(orderId: string, paymentMethod: string) {
    const settingKey = SETTING_KEYS[paymentMethod];
    if (!settingKey) return;

    const setting = await this.prisma.setting.findUnique({
      where: { key: settingKey },
    } as any);

    const minutes = setting
      ? parseInt(setting.value, 10)
      : DEFAULT_MINUTES[paymentMethod];

    const delayMs = minutes * 60 * 1000;

    await this.queue.add(
      'expire-order',
      { orderId },
      {
        delay: delayMs,
        jobId: `expire-${orderId}`,
      },
    );

    this.logger.log(
      `Scheduled expiration for order ${orderId} (${paymentMethod}) in ${minutes} minutes`,
    );
  }

  async cancelExpiration(orderId: string) {
    try {
      const job = await this.queue.getJob(`expire-${orderId}`);
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled expiration for order ${orderId}`);
      }
    } catch (err) {
      this.logger.warn(`Could not cancel expiration for ${orderId}: ${err}`);
    }
  }

  async processExpiration(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) return;

    if (order.status !== 'PENDING') {
      this.logger.log(
        `Order ${orderId} already ${order.status}, skipping expiration`,
      );
      return;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { orderId },
    });

    if (payment?.status === 'APPROVED') {
      this.logger.log(
        `Order ${orderId} payment already APPROVED, skipping expiration`,
      );
      return;
    }

    const method = (order as any).paymentMethod as string | null;
    const reason =
      (method && EXPIRATION_REASONS[method]) || DEFAULT_EXPIRATION_REASON;
    await this.ordersService.updateStatus(
      orderId,
      'CANCELLED',
      'SYSTEM_EXPIRATION',
      reason,
    );

    this.logger.warn(`Order ${orderId} expired and cancelled: ${reason}`);
  }
}
