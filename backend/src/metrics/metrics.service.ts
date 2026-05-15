import { Injectable } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly bullJobsTotal: Counter<string>;
  private readonly prismaQueryDuration: Histogram<string>;
  private readonly freeGiftRejectionsTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests per method, route, status_code',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],

      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.bullJobsTotal = new Counter({
      name: 'bullmq_jobs_total',
      help: 'Total BullMQ jobs per queue+status (completed, failed, active)',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.prismaQueryDuration = new Histogram({
      name: 'prisma_query_duration_seconds',
      help: 'Prisma query duration in seconds per target table',
      labelNames: ['target'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.3, 1, 2.5, 10],
      registers: [this.registry],
    });

    this.freeGiftRejectionsTotal = new Counter({
      name: 'free_gift_rejections_total',
      help: 'Total free-gift items rejected in validateFreeGiftItems by reason',
      labelNames: ['reason'],
      registers: [this.registry],
    });
  }

  observeHttp(
    method: string,
    route: string,
    statusCode: number,
    durationSec: number,
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: String(statusCode),
    };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSec);
  }

  observeBullJob(
    queue: string,
    status: 'completed' | 'failed' | 'active',
  ): void {
    this.bullJobsTotal.inc({ queue, status });
  }

  observePrismaQuery(target: string, durationSec: number): void {
    this.prismaQueryDuration.observe({ target }, durationSec);
  }

  observeFreeGiftRejection(
    reason:
      | 'no_freegift_id'
      | 'inactive_or_missing'
      | 'before_window'
      | 'expired'
      | 'subtotal_insufficient'
      | 'product_mismatch'
      | 'non_zero_price'
      | 'quantity_invalid'
      | 'cap_exceeded'
      | 'out_of_stock',
  ): void {
    this.freeGiftRejectionsTotal.inc({ reason });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  reset(): void {
    this.httpRequestsTotal.reset();
    this.httpRequestDuration.reset();
    this.bullJobsTotal.reset();
    this.prismaQueryDuration.reset();
    this.freeGiftRejectionsTotal.reset();
  }
}
