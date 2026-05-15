import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Roles('ADMIN')
@Throttle({ short: { limit: 3, ttl: 60000 } })
@Controller('api/v1/_debug')
export class DebugSentryController {
  constructor(private readonly prisma: PrismaService) { }

  @Get('throw')
  throwError(@Query('type') type?: string) {
    if (type === 'async') {
      return Promise.reject(
        new Error('Sentry test: async error from /api/_debug/throw'),
      );
    }
    if (type === 'undefined-fn') {
      // @ts-expect-error
      (globalThis as Record<string, unknown>).__nonexistent_fn__();
    }
    throw new Error('Sentry test: sync error from /api/_debug/throw');
  }

  @Get('slow-query')
  async slowQuery(@Query('ms') ms?: string): Promise<{ duration_ms: number }> {

    const parsed = parseInt(ms ?? '1000', 10);
    const sleepMs = Math.min(
      Math.max(isNaN(parsed) ? 1000 : parsed, 100),
      1000,
    );
    const start = Date.now();
    const seconds = sleepMs / 1000;

    await this.prisma.$transaction(
      async (tx) =>
        tx.$queryRaw(Prisma.sql`SELECT pg_sleep(${seconds})::text AS slept`),
      { timeout: 2000 },
    );
    return { duration_ms: Date.now() - start };
  }

  @Get('sentry-status')
  async sentryStatus() {
    const dsnPresent = !!process.env.SENTRY_DSN;
    const env = process.env.SENTRY_ENVIRONMENT ?? null;
    const release = process.env.APP_VERSION ?? null;
    const tracesRate = process.env.SENTRY_TRACES_SAMPLE_RATE ?? null;

    const testTag = `debug-sentry-status-${Date.now()}`;
    let captureId: string | undefined;
    let flushOk = false;
    if (dsnPresent) {
      captureId = Sentry.captureMessage(testTag, {
        level: 'info',
        tags: { debug: 'sentry-status' },
      });

      flushOk = await Sentry.flush(2000).catch(() => false);
    }

    return {
      dsnPresent,
      environment: env,
      release,
      tracesSampleRate: tracesRate,
      testTag,
      captureId: captureId ?? null,
      flushOk,
    };
  }
}
