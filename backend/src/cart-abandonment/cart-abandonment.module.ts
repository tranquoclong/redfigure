import {
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { SettingsModule } from '../settings/settings.module';
import { CouponsModule } from '../coupons/coupons.module';
import { UsersModule } from '../users/users.module';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureBullError } from '../observability/bullmq-error-capture';
import { CartAbandonmentService } from './cart-abandonment.service';
import { CartAbandonmentCronService } from './cart-abandonment.cron.service';

@Module({
  imports: [SettingsModule, CouponsModule, UsersModule],
  providers: [CartAbandonmentService, CartAbandonmentCronService],
  exports: [CartAbandonmentService],
})
export class CartAbandonmentModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CartAbandonmentModule.name);
  private worker: Worker | null = null;

  constructor(
    private readonly cron: CartAbandonmentCronService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) { }

  onModuleInit() {
    this.worker = new Worker(
      'cart-abandonment',
      async () => {
        await this.cron.processCleanup();
      },
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        concurrency: 1,
      }),
    );

    this.worker.on('completed', () => {
      this.logger.log('Cart abandonment job completed');
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Cart abandonment job failed: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'job_failed', 'cart-abandonment', job);
    });

    this.worker.on('error', (error) => {
      this.logger.error(
        `Cart abandonment worker error: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'worker_error', 'cart-abandonment');
    });

    this.logger.log('Cart abandonment worker started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
