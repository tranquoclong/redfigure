import {
  Module,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { ReviewInvitesService } from './review-invites.service';
import { ReviewInvitesController } from './review-invites.controller';
import { CouponsModule } from '../coupons/coupons.module';
import { SettingsModule } from '../settings/settings.module';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';
import { ReviewInvitesProcessor } from './review-invites.processor';
import { captureBullError } from '../observability/bullmq-error-capture';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';

@Module({
  imports: [CouponsModule, SettingsModule, MediaModule, UsersModule],
  controllers: [ReviewInvitesController],
  providers: [ReviewInvitesService, ReviewInvitesProcessor],
  exports: [ReviewInvitesService],
})
export class ReviewInvitesModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewInvitesModule.name);
  private worker: Worker | null = null;

  constructor(
    private readonly processor: ReviewInvitesProcessor,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) { }

  onModuleInit() {
    this.worker = new Worker(
      'review-invites',
      async (job) => {
        await this.processor.handle(job.name, job.data);
      },
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        concurrency: 3,
      }),
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Review invite job ${job.id} completed: ${job.name}`);
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Review invite job ${job?.id} failed: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'job_failed', 'review-invites', job);
    });

    this.worker.on('error', (error) => {
      this.logger.error(
        `Review invites worker error: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'worker_error', 'review-invites');
    });

    this.logger.log('Review invites worker started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
