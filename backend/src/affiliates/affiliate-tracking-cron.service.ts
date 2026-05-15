import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureBullError } from '../observability/bullmq-error-capture';

const PRUNE_JOB_ID = 'affiliate-visit-prune-recurring';

@Injectable()
export class AffiliateTrackingCronService
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AffiliateTrackingCronService.name);
  private queue: Queue;

  constructor(
    private readonly tracking: AffiliateTrackingService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) {
    this.queue = new Queue(
      'affiliate-visit-prune',
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

    this.queue.on('error', (err) => {
      this.logger.error(`Queue error: ${err.message}`, err.stack);
      captureBullError(err, 'queue_error', 'affiliate-visit-prune');
    });
  }

  async onModuleInit() {
    try {
      await this.queue.add(
        'prune-old-visits',
        {},
        {
          repeat: { pattern: '0 3 * * *' },
          jobId: PRUNE_JOB_ID,
        },
      );
      this.logger.log('Affiliate visit prune scheduled (daily 03:00)');
    } catch (err) {
      this.logger.error(
        `Failed to schedule affiliate visit prune: ${err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async processPrune(): Promise<void> {
    const count = await this.tracking.pruneOldVisits();
    this.logger.log(`Affiliate visit prune done: ${count} visit(s) deleted`);
  }
}
