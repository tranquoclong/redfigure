import {
  Module,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderExpirationService } from './order-expiration.service';
import { TrashCleanupService } from './trash-cleanup.service';
// import { PaymentsModule } from '../payments/payments.module';
import { StockModule } from '../stock/stock.module';
import { PricingModule } from '../pricing/pricing.module';
import { ReviewInvitesModule } from '../review-invites/review-invites.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureBullError } from '../observability/bullmq-error-capture';

@Module({
  imports: [
    // forwardRef(() => PaymentsModule),
    StockModule,
    PricingModule,
    ReviewInvitesModule,
    AffiliatesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExpirationService, TrashCleanupService],
  exports: [OrdersService, OrderExpirationService, TrashCleanupService],
})
export class OrdersModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersModule.name);
  private expirationWorker: Worker | null = null;

  constructor(
    private readonly orderExpirationService: OrderExpirationService,
  ) { }

  onModuleInit() {
    this.expirationWorker = new Worker(
      'order-expiration',
      async (job) => {
        await this.orderExpirationService.processExpiration(job.data.orderId);
      },
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        concurrency: 3,
      }),
    );

    this.expirationWorker.on('completed', (job) => {
      this.logger.log(`Order expiration job ${job.id} completed`);
    });

    this.expirationWorker.on('failed', (job, error) => {
      this.logger.error(
        `Order expiration job ${job?.id} failed: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'job_failed', 'order-expiration', job);
    });

    this.expirationWorker.on('error', (error) => {
      this.logger.error(
        `Order expiration worker error: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'worker_error', 'order-expiration');
    });

    this.logger.log('Order expiration worker started');
  }

  async onModuleDestroy() {
    await this.expirationWorker?.close();
  }
}
