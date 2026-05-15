import {
  LOG_REDACT_PATHS,
  PINO_REDACT_OPTIONS,
  redactObject,
} from './log-redact';

describe('log-redact', () => {
  describe('LOG_REDACT_PATHS', () => {
    it('includes all fiscal PII paths (LGPD)', () => {
      const required = ['cccd', 'mst', 'payerCccd', 'email', 'phone'];
      for (const path of required) {
        expect(LOG_REDACT_PATHS).toContain(path);
      }
    });

    it('includes credentials and tokens', () => {
      const required = [
        'password',
        'passwordHash',
        'refreshToken',
        'accessToken',
        'authorization',
        'cookie',
      ];
      for (const path of required) {
        expect(LOG_REDACT_PATHS).toContain(path);
      }
    });

    it('includes integration secrets', () => {
      const required = [
        'clientSecret',
        'jwtSecret',
        'affiliateIpHashSalt',
        'webhookSecret',
        'turnstileSecret',
      ];
      for (const path of required) {
        expect(LOG_REDACT_PATHS).toContain(path);
      }
    });

    it('covers auth/payments bodies with qualified paths', () => {
      const required = [
        'req.body.password',
        'req.body.cccd',
        'req.body.mst',
        'req.body.refreshToken',
      ];
      for (const path of required) {
        expect(LOG_REDACT_PATHS).toContain(path);
      }
    });
  });

  describe('PINO_REDACT_OPTIONS', () => {
    it('shape for Pino: paths + censor + remove=false', () => {
      expect(PINO_REDACT_OPTIONS).toEqual({
        paths: LOG_REDACT_PATHS,
        censor: '[Redacted]',
        remove: false,
      });
    });
  });

  describe('redactObject', () => {
    it('returns primitives without changes', () => {
      expect(redactObject('hello')).toBe('hello');
      expect(redactObject(42)).toBe(42);
      expect(redactObject(true)).toBe(true);
      expect(redactObject(null)).toBeNull();
      expect(redactObject(undefined)).toBeUndefined();
    });

    it('redacts PII keys in flat object', () => {
      const result = redactObject({
        name: 'John',
        cccd: '001100000001',
        email: 'john@example.com',
      });
      expect(result).toEqual({
        name: 'John',
        cccd: '[Redacted]',
        email: '[Redacted]',
      });
    });

    it('is case-insensitive — CCCD, Cccd, cccd all redact', () => {
      const result = redactObject({
        CCCD: '11122233344',
        Cccd: '55566677788',
        mst: '0101234565001',
      });
      expect(result.CCCD).toBe('[Redacted]');
      expect(result.Cccd).toBe('[Redacted]');
      expect(result.mst).toBe('[Redacted]');
    });

    it('redacts recursively in nested objects', () => {
      const result = redactObject({
        user: {
          name: 'John',
          credentials: {
            password: 'secret123',
            refreshToken: 'rt_abc',
          },
        },
        meta: { ip: '1.2.3.4' },
      });
      expect(result.user.name).toBe('John');
      expect(result.user.credentials.password).toBe('[Redacted]');
      expect(result.user.credentials.refreshToken).toBe('[Redacted]');
      expect(result.meta.ip).toBe('1.2.3.4');
    });

    it('redacts inside arrays', () => {
      const result = redactObject({
        users: [
          { name: 'A', cccd: '001100000001' },
          { name: 'B', email: 'b@x.com' },
        ],
      });
      expect(result.users[0].cccd).toBe('[Redacted]');
      expect(result.users[1].email).toBe('[Redacted]');
      expect(result.users[0].name).toBe('A');
    });

    it('redacts in Sentry-like payload (request.body)', () => {
      const event = {
        request: {
          url: '/api/v1/auth/login',
          headers: {
            authorization: 'Bearer abc123',
            cookie: 'session=xyz',
          },
          body: {
            email: 'user@example.com',
            password: 'mypass',
          },
        },
      };
      const result = redactObject(event);
      expect(result.request.headers.authorization).toBe('[Redacted]');
      expect(result.request.headers.cookie).toBe('[Redacted]');
      expect(result.request.body.email).toBe('[Redacted]');
      expect(result.request.body.password).toBe('[Redacted]');
      expect(result.request.url).toBe('/api/v1/auth/login');
    });

    it('preserves non-PII values', () => {
      const input = {
        statusCode: 500,
        path: '/api/v1/products',
        method: 'GET',
        durationMs: 234,
      };
      expect(redactObject(input)).toEqual(input);
    });

    it('limits depth to prevent stack overflow in cycles', () => {
      const a: { next?: unknown; cccd: string } = { cccd: '111' };
      const b: { next?: unknown; email: string } = { email: 'x@x.com' };
      a.next = b;
      b.next = a;

      expect(() => redactObject(a)).not.toThrow();
    });
  });
});
