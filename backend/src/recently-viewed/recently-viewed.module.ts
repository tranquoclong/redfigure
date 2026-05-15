import {
  Module,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { RecentlyViewedController } from './recently-viewed.controller';
import { RecentlyViewedService } from './recently-viewed.service';
import { ViewedCleanupService } from './viewed-cleanup.service';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureBullError } from '../observability/bullmq-error-capture';

@Module({
  controllers: [RecentlyViewedController],
  providers: [RecentlyViewedService, ViewedCleanupService],
  exports: [RecentlyViewedService],
})
export class RecentlyViewedModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecentlyViewedModule.name);
  private cleanupWorker: Worker | null = null;

  constructor(
    private readonly viewedCleanupService: ViewedCleanupService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) { }

  onModuleInit() {
    this.cleanupWorker = new Worker(
      'viewed-anon-cleanup',
      async () => {
        await this.viewedCleanupService.processCleanup();
      },
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        concurrency: 1,
      }),
    );

    this.cleanupWorker.on('completed', () => {
      this.logger.log('Viewed anonymous cleanup job completed');
    });

    this.cleanupWorker.on('failed', (job, error) => {
      this.logger.error(
        `Viewed anonymous cleanup job failed: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'job_failed', 'viewed-anon-cleanup', job);
    });

    this.cleanupWorker.on('error', (error) => {
      this.logger.error(
        `Viewed anonymous cleanup worker error: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'worker_error', 'viewed-anon-cleanup');
    });

    this.logger.log('Viewed anonymous cleanup worker started');
  }

  async onModuleDestroy() {
    await this.cleanupWorker?.close();
  }
}
