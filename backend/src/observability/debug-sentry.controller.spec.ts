import { Test, TestingModule } from '@nestjs/testing';
import { DebugSentryController } from './debug-sentry.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('DebugSentryController', () => {
  let controller: DebugSentryController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    prisma = {
      $queryRaw: queryRaw,

      $transaction: jest
        .fn()
        .mockImplementation(async (cb) =>
          typeof cb === 'function' ? cb({ $queryRaw: queryRaw }) : cb,
        ),
    } as unknown as { $queryRaw: jest.Mock };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DebugSentryController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();
    controller = module.get<DebugSentryController>(DebugSentryController);
  });

  describe('GET /api/_debug/throw', () => {
    it('default type throws sync Error — becomes 500 + capture in Sentry', () => {
      expect(() => controller.throwError()).toThrow(/Sentry test/i);
    });

    it('type=async returns Promise rejected', async () => {
      await expect(controller.throwError('async')).rejects.toThrow(
        /Sentry test/i,
      );
    });

    it('type=undefined-fn calls non-existent function — TypeError', () => {
      expect(() => controller.throwError('undefined-fn')).toThrow(TypeError);
    });

    it('accepts empty query string (default sync)', () => {
      expect(() => controller.throwError(undefined)).toThrow();
    });
  });

  describe('GET /api/_debug/slow-query', () => {
    it('default 1000ms — calls prisma.$transaction with pg_sleep + timeout 2000', async () => {
      const result = await controller.slowQuery();
      const txMock = (prisma as unknown as { $transaction: jest.Mock })
        .$transaction;
      expect(txMock).toHaveBeenCalledTimes(1);

      expect(txMock.mock.calls[0][1]).toEqual({ timeout: 2000 });
      expect(result).toHaveProperty('duration_ms');
      expect(typeof result.duration_ms).toBe('number');
    });

    it('clamp inferior 100ms', async () => {
      await controller.slowQuery('50');
      expect(
        (prisma as unknown as { $transaction: jest.Mock }).$transaction,
      ).toHaveBeenCalled();
    });

    it('clamp superior 1000ms (anti pool exhaustion — Gemini R2 🟡)', async () => {
      await controller.slowQuery('99999');
      expect(
        (prisma as unknown as { $transaction: jest.Mock }).$transaction,
      ).toHaveBeenCalled();
    });

    it('rejeita non-number — fallback default 1000ms', async () => {
      await controller.slowQuery('not-a-number');
      expect(
        (prisma as unknown as { $transaction: jest.Mock }).$transaction,
      ).toHaveBeenCalled();
    });
  });
});
