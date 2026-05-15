import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { handleSlowQuery } from './slow-query';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  constructor(private readonly metrics: MetricsService) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    (
      this as PrismaClient & {
        $on: (e: string, cb: (e: unknown) => void) => void;
      }
    ).$on('query', (event: unknown) => {
      const e = event as { duration: number; target: string };

      this.metrics.observePrismaQuery(e.target, e.duration / 1000);

      handleSlowQuery(
        event as Parameters<typeof handleSlowQuery>[0],
        {
          warn: (payload, msg) =>
            this.logger.warn(JSON.stringify({ msg, ...payload })),
          error: (payload, msg) =>
            this.logger.error(JSON.stringify({ msg, ...payload })),
        },
        (bc) => Sentry.addBreadcrumb(bc),
      );
    });
  }

  async onModuleInit() {
    await this.$connect();

  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
