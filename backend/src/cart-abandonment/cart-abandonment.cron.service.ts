import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureBullError } from '../observability/bullmq-error-capture';
import { captureFailOpen } from '../observability/fail-open-capture';
import { CartAbandonmentService } from './cart-abandonment.service';

const QUEUE_NAME = 'cart-abandonment';
const RECURRING_JOB_ID = 'cart-abandonment-recurring';

@Injectable()
export class CartAbandonmentCronService
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CartAbandonmentCronService.name);
  private readonly queue: Queue;

  constructor(
    private readonly service: CartAbandonmentService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) {
    this.queue = new Queue(
      QUEUE_NAME,
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

    this.queue.on('error', (err: Error) => {
      this.logger.error(`Queue error: ${err.message}`, err.stack);
      captureBullError(err, 'queue_error', QUEUE_NAME);
    });
  }

  async onModuleInit() {
    try {
      await this.queue.add(
        'process-abandoned-carts',
        {},
        {
          repeat: { pattern: '0 1 * * *' },
          jobId: RECURRING_JOB_ID,
        },
      );
      this.logger.log('Cart abandonment scheduled (daily 01:00)');
    } catch (err) {

      this.logger.error(
        `Failed to schedule cart abandonment: ${err instanceof Error ? err.message : String(err)
        }`,
      );
      captureFailOpen(err, 'cart_abandonment_schedule');
    }
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async processCleanup(): Promise<{
    firstSent: number;
    secondSent: number;
    skipped: number;
  }> {
    const result = await this.service.processAbandonedCarts();
    this.logger.log(
      `Cart abandonment done: firstSent=${result.firstSent}, secondSent=${result.secondSent}, skipped=${result.skipped}`,
    );
    return result;
  }
}
