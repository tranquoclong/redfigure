import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';

const TRASH_RETENTION_DAYS = 30;
const CLEANUP_JOB_ID = 'order-trash-cleanup-recurring';

@Injectable()
export class TrashCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrashCleanupService.name);
  private queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) {
    this.queue = new Queue(
      'order-trash-cleanup',
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
        'cleanup-trash',
        {},
        {
          repeat: { pattern: '0 3 * * *' },
          jobId: CLEANUP_JOB_ID,
        },
      );
      this.logger.log(
        `Trash cleanup scheduled (daily 03:00, retention=${TRASH_RETENTION_DAYS}d)`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to schedule trash cleanup: ${err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async processCleanup(): Promise<void> {
    const cutoff = new Date(
      Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const expired = await this.prisma.order.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    });

    if (expired.length === 0) {
      this.logger.log('Trash cleanup: no expired orders to delete');
      return;
    }

    this.logger.log(
      `Trash cleanup: deleting ${expired.length} expired order(s)`,
    );

    let deleted = 0;
    let failed = 0;
    for (const { id } of expired) {
      try {
        await this.prisma.order.delete({ where: { id } });
        deleted++;
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed to hard delete order ${id}: ${err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(`Trash cleanup done: ${deleted} deleted, ${failed} failed`);
  }
}
