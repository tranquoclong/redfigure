import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { RecentlyViewedService } from './recently-viewed.service';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';

const CLEANUP_JOB_ID = 'viewed-anon-cleanup-recurring';

@Injectable()
export class ViewedCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ViewedCleanupService.name);
  private queue: Queue;

  constructor(
    private readonly recentlyViewedService: RecentlyViewedService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) {
    this.queue = new Queue(
      'viewed-anon-cleanup',
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: { count: 30 },
          removeOnFail: { count: 30 },
        },
      }),
    );
  }

  async onModuleInit() {
    try {
      await this.queue.add(
        'cleanup-viewed-anon',
        {},
        {
          repeat: { pattern: '0 4 * * *' },
          jobId: CLEANUP_JOB_ID,
        },
      );
      this.logger.log('Viewed anon cleanup scheduled (daily 04:00)');
    } catch (err) {
      this.logger.error(
        `Failed to schedule viewed cleanup: ${err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async processCleanup(): Promise<void> {
    const deleted = await this.recentlyViewedService.cleanupAnonymous();
    this.logger.log(
      `Viewed cleanup done: ${deleted} anonymous records deleted`,
    );
  }
}
