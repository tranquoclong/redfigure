import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import { WEBHOOK_SIGNATURE_KEY } from '../decorators/webhook-signature.decorator';

describe('WebhookSignatureGuard', () => {
  let guard: WebhookSignatureGuard;
  const mockReflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const mockConfig = { get: jest.fn() } as unknown as ConfigService;
  const mockSettings = { get: jest.fn(), decrypt: jest.fn() };
  const mockMpClient = { verifyWebhookSignature: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new WebhookSignatureGuard(
      mockReflector,
      mockConfig,
      mockSettings as any,
      mockMpClient as any,
    );
  });

  function makeContext(req: any): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  }

  describe('Misconfiguration', () => {
    it('rejects when guard is active without the @WebhookSignature decorator (fail-closed)', async () => {
      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
      const ctx = makeContext({ headers: {}, query: {}, body: {} });

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Sepay', () => {
    beforeEach(() => {
      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(
        'sepay',
      );
    });

    it('rejects without query webhookSecret', async () => {
      const ctx = makeContext({ headers: {}, query: {}, body: {} });
      await expect(guard.canActivate(ctx)).rejects.toThrow(/Invalid webhook/);
    });

    it('rejects non-string webhookSecret (HPP/type confusion)', async () => {
      const ctx = makeContext({
        headers: {},
        query: { webhookSecret: ['array', 'attack'] },
        body: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow();
    });

    it('rejects when secret is not configured in settings', async () => {
      mockSettings.get.mockResolvedValue(null);
      const ctx = makeContext({
        headers: {},
        query: { webhookSecret: 'something' },
        body: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(/Invalid webhook/);
    });

    it('rejects when decrypt fails', async () => {
      mockSettings.get.mockResolvedValue('encrypted');
      mockSettings.decrypt.mockImplementation(() => {
        throw new Error('Bad cipher');
      });
      const ctx = makeContext({
        headers: {},
        query: { webhookSecret: 'something' },
        body: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow();
    });

    it('rejects wrong secret (same length for timingSafeEqual hit)', async () => {
      mockSettings.get.mockResolvedValue('encrypted');
      mockSettings.decrypt.mockReturnValue('aaaaaaaaaaaaa');
      const ctx = makeContext({
        headers: {},
        query: { webhookSecret: 'bbbbbbbbbbbbb' },
        body: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow();
    });

    it('rejects secret of different size (hash neutralizes, but fails equal)', async () => {
      mockSettings.get.mockResolvedValue('encrypted');
      mockSettings.decrypt.mockReturnValue('real_secret_longo');
      const ctx = makeContext({
        headers: {},
        query: { webhookSecret: 'curto' },
        body: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow();
    });

    it('accepts correct secret', async () => {
      mockSettings.get.mockResolvedValue('encrypted');
      mockSettings.decrypt.mockReturnValue('real_secret');
      const ctx = makeContext({
        headers: {},
        query: { webhookSecret: 'real_secret' },
        body: {},
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

});
