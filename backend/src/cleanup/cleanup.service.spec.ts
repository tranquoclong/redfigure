import { Test, TestingModule } from '@nestjs/testing';
import { CleanupService } from './cleanup.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('CleanupService — daily cron expired tokens + recently_viewed', () => {
  let service: CleanupService;
  let prisma: { $executeRaw: jest.Mock };
  let redis: { setNX: jest.Mock; releaseLock: jest.Mock };

  beforeEach(async () => {
    prisma = {

      $executeRaw: jest.fn().mockResolvedValue(0),
    };
    redis = {
      setNX: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
  });

  describe('runCleanup', () => {
    it('lock Redis: skip cleanup if another instance acquired', async () => {
      redis.setNX.mockResolvedValue(false);

      await service.runCleanup();

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('releases lock in finally (even if cleanup fails)', async () => {
      prisma.$executeRaw.mockRejectedValueOnce(new Error('DB connection lost'));

      await service.runCleanup();

      expect(redis.releaseLock).toHaveBeenCalled();
    });

    it('refresh_tokens: delete with 5min buffer in revokedAt + chunked LIMIT', async () => {

      prisma.$executeRaw.mockResolvedValueOnce(12);
      prisma.$executeRaw.mockResolvedValueOnce(0);

      await service.runCleanup();

      const firstCall = prisma.$executeRaw.mock.calls[0];
      const sqlFragments = firstCall[0] as TemplateStringsArray;
      const sql = sqlFragments.join('?');
      expect(sql).toMatch(/DELETE FROM "refresh_tokens"/);
      expect(sql).toMatch(/"revokedAt" IS NOT NULL AND "revokedAt" </);
      expect(sql).toMatch(/"expiresAt" < NOW\(\)/);
      expect(sql).toMatch(/LIMIT/);

      const revokedCutoff = firstCall[1] as Date;
      expect(revokedCutoff).toBeInstanceOf(Date);
      const expectedCutoff = Date.now() - 5 * 60 * 1000;
      expect(Math.abs(revokedCutoff.getTime() - expectedCutoff)).toBeLessThan(
        2_000,
      );
    });

    it('refresh_tokens: chunked loop continues while lastBatch > 0 (Gemini R3 — race tolerant)', async () => {

      prisma.$executeRaw
        .mockResolvedValueOnce(5000)
        .mockResolvedValueOnce(4999)
        .mockResolvedValueOnce(123)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await service.runCleanup();

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(5);
    });

    it('circuit breaker MAX_CLEANUP_ITERATIONS=100 (anti infinite loop)', async () => {

      prisma.$executeRaw.mockResolvedValue(5000);

      await service.runCleanup();

      const calls = prisma.$executeRaw.mock.calls.length;
      expect(calls).toBeGreaterThanOrEqual(100);
      expect(calls).toBeLessThanOrEqual(200);
    });

    it('SQL includes ORDER BY id ASC (anti deadlock PostgreSQL)', async () => {
      prisma.$executeRaw.mockResolvedValueOnce(0);
      prisma.$executeRaw.mockResolvedValueOnce(0);

      await service.runCleanup();

      const refreshSql = (
        prisma.$executeRaw.mock.calls[0][0] as TemplateStringsArray
      ).join('?');
      const recentlySql = (
        prisma.$executeRaw.mock.calls[1][0] as TemplateStringsArray
      ).join('?');
      expect(refreshSql).toMatch(/ORDER BY id ASC/);
      expect(recentlySql).toMatch(/ORDER BY id ASC/);
    });

    it('recently_viewed: delete viewed_at < now - 90d, chunked', async () => {
      prisma.$executeRaw.mockResolvedValueOnce(0);
      prisma.$executeRaw.mockResolvedValueOnce(50);

      await service.runCleanup();

      const secondCall = prisma.$executeRaw.mock.calls[1];
      const sql = (secondCall[0] as TemplateStringsArray).join('?');
      expect(sql).toMatch(/DELETE FROM "recently_viewed"/);
      expect(sql).toMatch(/"viewed_at" </);
      expect(sql).toMatch(/LIMIT/);

      const cutoff = secondCall[1] as Date;
      const expected = Date.now() - 90 * 24 * 60 * 60 * 1000;
      expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(2_000);
    });

    it('error in refreshToken cleanup DOES NOT prevent recentlyViewed cleanup', async () => {
      prisma.$executeRaw
        .mockRejectedValueOnce(new Error('PG read-only'))
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(0);

      await service.runCleanup();

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    });
  });
});
