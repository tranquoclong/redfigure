import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let fetchSpy: jest.SpyInstance;

  async function makeService(secret?: string): Promise<TurnstileService> {
    const module = await Test.createTestingModule({
      providers: [
        TurnstileService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'TURNSTILE_SECRET_KEY' ? secret : undefined,
            ),
          },
        },
      ],
    }).compile();
    return module.get(TurnstileService);
  }

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('verify', () => {
    it('returns true when CF siteverify responds success=true', async () => {
      const service = await makeService('secret');
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

      const ok = await service.verify('tok', '1.2.3.4');

      expect(ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns false when CF siteverify responds success=false', async () => {
      const service = await makeService('secret');
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            'error-codes': ['timeout-or-duplicate'],
          }),
          { status: 200 },
        ),
      );
      expect(await service.verify('tok')).toBe(false);
    });

    it('returns false for empty or whitespace-only token (no network call)', async () => {
      const service = await makeService('secret');
      expect(await service.verify('')).toBe(false);
      expect(await service.verify('   ')).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fails closed when TURNSTILE_SECRET_KEY not configured', async () => {
      const service = await makeService(undefined);
      expect(await service.verify('tok')).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fails closed when fetch throws (network error)', async () => {
      const service = await makeService('secret');
      fetchSpy.mockRejectedValue(new Error('network down'));
      expect(await service.verify('tok')).toBe(false);
    });

    it('fails closed when CF returns non-200 status', async () => {
      const service = await makeService('secret');
      fetchSpy.mockResolvedValue(new Response('', { status: 500 }));
      expect(await service.verify('tok')).toBe(false);
    });

    it('fails closed on AbortError (timeout)', async () => {
      const service = await makeService('secret');
      const err = new Error('aborted');
      err.name = 'AbortError';
      fetchSpy.mockRejectedValue(err);
      expect(await service.verify('tok')).toBe(false);
    });

    it('includes remoteip in request body when provided', async () => {
      const service = await makeService('secret');
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ success: true })),
      );
      await service.verify('tok', '1.2.3.4');

      const body = fetchSpy.mock.calls[0][1].body as URLSearchParams;
      expect(body.get('remoteip')).toBe('1.2.3.4');
      expect(body.get('response')).toBe('tok');
      expect(body.get('secret')).toBe('secret');
    });

    it('omits remoteip when not provided', async () => {
      const service = await makeService('secret');
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ success: true })),
      );
      await service.verify('tok');
      const body = fetchSpy.mock.calls[0][1].body as URLSearchParams;
      expect(body.get('remoteip')).toBeNull();
    });
  });
});
