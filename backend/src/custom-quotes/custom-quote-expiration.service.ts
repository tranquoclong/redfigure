import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { CustomQuotesService } from './custom-quotes.service';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureBullError } from '../observability/bullmq-error-capture';
import { captureFailOpen } from '../observability/fail-open-capture';

const CLEANUP_JOB_ID = 'custom-quote-expiration-recurring';

@Injectable()
export class CustomQuoteExpirationService
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CustomQuoteExpirationService.name);
  private queue: Queue;

  constructor(
    private readonly quotesService: CustomQuotesService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) {
    this.queue = new Queue(
      'custom-quote-expiration',
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
      captureBullError(err, 'queue_error', 'custom-quote-expiration');
    });
  }

  async onModuleInit() {
    try {
      await this.queue.add(
        'expire-outdated',
        {},
        {
          repeat: { pattern: '0 2 * * *' },
          jobId: CLEANUP_JOB_ID,
        },
      );
      this.logger.log('Custom quote expiration scheduled (daily 02:00)');
    } catch (err) {
      this.logger.error(
        `Failed to schedule custom quote expiration: ${err instanceof Error ? err.message : String(err)
        }`,
      );
      captureFailOpen(err, 'custom_quote_expiration_schedule');
    }
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async processCleanup(): Promise<void> {
    const result = await this.quotesService.expireOutdated();
    this.logger.log(
      `Custom quote expiration done: ${result.count} quote(s) marked EXPIRED`,
    );
  }
}
