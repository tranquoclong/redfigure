import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CLEANUP_LOCK_KEY = 'cleanup:expired-tokens-and-views:lock';
const CLEANUP_LOCK_TTL_SECONDS = 5 * 60;
const RECENTLY_VIEWED_RETENTION_DAYS = 90;

const REVOKED_GRACE_BUFFER_MS = 5 * 60 * 1000;

const CLEANUP_BATCH_SIZE = 5_000;

const MAX_CLEANUP_ITERATIONS = 100;

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) { }

  @Cron('0 4 * * *')
  async scheduledRun(): Promise<void> {
    try {
      await this.runCleanup();
    } catch (err) {

      Sentry.captureException(err, {
        tags: { cron: 'cleanup-scheduled-run' },
      });
      throw err;
    }
  }

  async runCleanup(): Promise<void> {
    const lockValue = randomUUID();
    const acquired = await this.redis.setNX(
      CLEANUP_LOCK_KEY,
      lockValue,
      CLEANUP_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      this.logger.debug('Cleanup skipped — another instance holds the lock');
      return;
    }

    try {
      await this.cleanupRefreshTokens();
      await this.cleanupRecentlyViewed();
    } finally {

      await this.redis
        .releaseLock(CLEANUP_LOCK_KEY, lockValue)
        .catch((err: unknown) => {
          this.logger.warn(
            `Cleanup lock release failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }
  }

  private async cleanupRefreshTokens(): Promise<void> {
    try {

      const revokedCutoff = new Date(Date.now() - REVOKED_GRACE_BUFFER_MS);
      let totalDeleted = 0;
      let lastBatch = 0;
      let iterations = 0;

      do {
        lastBatch = await this.prisma.$executeRaw`
          DELETE FROM "refresh_tokens"
          WHERE id IN (
            SELECT id FROM "refresh_tokens"
            WHERE ("revokedAt" IS NOT NULL AND "revokedAt" < ${revokedCutoff})
               OR ("expiresAt" < NOW())
            ORDER BY id ASC
            LIMIT ${CLEANUP_BATCH_SIZE}
          )
        `;
        totalDeleted += lastBatch;
        iterations++;
      } while (lastBatch > 0 && iterations < MAX_CLEANUP_ITERATIONS);

      if (totalDeleted > 0) {
        this.logger.log(
          `Cleanup: ${totalDeleted} refresh_tokens deleted (${iterations} batches)`,
        );
      }
      if (iterations >= MAX_CLEANUP_ITERATIONS) {
        this.logger.warn(
          `Cleanup refresh_tokens hit MAX_CLEANUP_ITERATIONS — backlog continues, next run takes the rest`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Cleanup refresh_tokens failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async cleanupRecentlyViewed(): Promise<void> {
    try {
      const cutoff = new Date(
        Date.now() - RECENTLY_VIEWED_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      let totalDeleted = 0;
      let lastBatch = 0;
      let iterations = 0;
      do {
        lastBatch = await this.prisma.$executeRaw`
          DELETE FROM "recently_viewed"
          WHERE id IN (
            SELECT id FROM "recently_viewed"
            WHERE "viewed_at" < ${cutoff}
            ORDER BY id ASC
            LIMIT ${CLEANUP_BATCH_SIZE}
          )
        `;
        totalDeleted += lastBatch;
        iterations++;
      } while (lastBatch > 0 && iterations < MAX_CLEANUP_ITERATIONS);

      if (totalDeleted > 0) {
        this.logger.log(
          `Cleanup: ${totalDeleted} recently_viewed (>${RECENTLY_VIEWED_RETENTION_DAYS}d) deleted (${iterations} batches)`,
        );
      }
      if (iterations >= MAX_CLEANUP_ITERATIONS) {
        this.logger.warn(
          `Cleanup recently_viewed hit MAX_CLEANUP_ITERATIONS — backlog continues, next run takes the rest`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Cleanup recently_viewed failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
