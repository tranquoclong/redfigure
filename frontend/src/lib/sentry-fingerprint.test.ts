import { describe, it, expect } from 'vitest';
import {
  computeAxiosFingerprint,
  extractAxiosStatus,
  normalizeUrlPath,
} from './sentry-fingerprint';

describe('normalizeUrlPath', () => {
  it('keeps static path', () => {
    expect(normalizeUrlPath('/orders')).toBe('/orders');
    expect(normalizeUrlPath('/users/me')).toBe('/users/me');
    expect(normalizeUrlPath('/auth/refresh')).toBe('/auth/refresh');
  });

  it('strip query string (params don\'t change the bug type)', () => {
    expect(normalizeUrlPath('/orders?perPage=10')).toBe('/orders');
    expect(normalizeUrlPath('/orders?page=1&perPage=10&search=foo')).toBe(
      '/orders',
    );
  });

  it('replaces cuid v1 with :id (c + 20-29 chars format)', () => {
    expect(normalizeUrlPath('/products/cmoevheya02osrw01ijp2i4rd')).toBe(
      '/products/:id',
    );
    expect(normalizeUrlPath('/orders/cmni5i78p0000nr9zans7qbmz/items')).toBe(
      '/orders/:id/items',
    );
  });

  it('replaces UUID v4 with :id', () => {
    expect(
      normalizeUrlPath('/sessions/550e8400-e29b-41d4-a716-446655440000'),
    ).toBe('/sessions/:id');
  });

  it('replaces numeric id', () => {
    expect(normalizeUrlPath('/categories/42')).toBe('/categories/:id');
    expect(normalizeUrlPath('/orders/123/items/45')).toBe(
      '/orders/:id/items/:id',
    );
  });

  it('extracts pathname from absolute URL', () => {
    expect(
      normalizeUrlPath(
        'https://staging-api.redfigure.com/api/v1/orders?perPage=1',
      ),
    ).toBe('/api/v1/orders');
  });

  it('returns "unknown" for empty/null input', () => {
    expect(normalizeUrlPath(undefined)).toBe('unknown');
    expect(normalizeUrlPath(null)).toBe('unknown');
    expect(normalizeUrlPath('')).toBe('unknown');
  });

  it('DOES NOT confuse normal slug with id', () => {

    expect(normalizeUrlPath('/users/me')).toBe('/users/me');

    expect(normalizeUrlPath('/admin/product-questions/pending-count')).toBe(
      '/admin/product-questions/pending-count',
    );
  });

  it('strip hash fragment in fallback (#email= may contain PII)', () => {

    const out = normalizeUrlPath('not-a-url#email=foo@bar.com');
    expect(out).not.toContain('#');
    expect(out).not.toContain('email=');
  });

  it('masks email in path as :id (defense-in-depth)', () => {

    expect(normalizeUrlPath('/users/foo@bar.com/profile')).toBe(
      '/users/:id/profile',
    );
  });

  it('masks document (CCCD/MST raw or hyphenated) as :id', () => {

    expect(normalizeUrlPath('/users/12345678901')).toBe('/users/:id');

    expect(normalizeUrlPath('/empresas/12345678000199')).toBe('/empresas/:id');

    expect(normalizeUrlPath('/users/123.456.789-01')).toBe('/users/:id');
  });

  it('truncates very long URL (memory pressure defense)', () => {

    const giant = '/x/' + 'a'.repeat(50_000);
    const out = normalizeUrlPath(giant);
    expect(out.length).toBeLessThanOrEqual(1100);
  });

  it('malformed URL falls into safe sentinel (no credential leak)', () => {

    const malformed = 'https://admin:secret_pwd@host:abc/orders';
    const out = normalizeUrlPath(malformed);
    expect(out).not.toContain('secret_pwd');
    expect(out).not.toContain('admin');
    expect(out).toBe('/malformed-url');
  });

  it('masks segment even if percent-encoded (does not bypass regex via %40)', () => {

    expect(normalizeUrlPath('/users/john.doe%40example.com/profile')).toBe(
      '/users/:id/profile',
    );

    expect(normalizeUrlPath('/orders/%31%32%33%34%35%36%37%38%39%30%31')).toBe(
      '/orders/:id',
    );
  });

  it('malformed decode doesn\'t break (segment kept raw)', () => {

    expect(() => normalizeUrlPath('/x/foo%2/bar')).not.toThrow();
  });

  it('masks even if raw segment matches ID (belt-and-suspenders defense)', () => {

    expect(normalizeUrlPath('/products/cmoevheya02osrw01ijp2i4rd')).toBe(
      '/products/:id',
    );
  });

  it('truncation cuts at segment boundary (does not split ID in half)', () => {

    const longPrefix = '/x/' + 'a/'.repeat(495);
    const url = longPrefix + 'cmoevheya02osrw01ijp2i4rd';
    const out = normalizeUrlPath(url);

    expect(out).not.toMatch(/cmoe[a-z0-9]{1,29}$/);
  });

  it('truncation respects Unicode (no lone surrogate)', () => {

    const giant = '/x/' + '😀'.repeat(700);
    const out = normalizeUrlPath(giant);

    for (let i = 0; i < out.length; i++) {
      const code = out.charCodeAt(i);
      const isHighSurrogate = code >= 0xd800 && code <= 0xdbff;
      const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;
      if (isHighSurrogate) {
        const next = out.charCodeAt(i + 1);
        expect(next >= 0xdc00 && next <= 0xdfff).toBe(true);
      }
      if (isLowSurrogate && i > 0) {
        const prev = out.charCodeAt(i - 1);
        expect(prev >= 0xd800 && prev <= 0xdbff).toBe(true);
      }
    }
  });
});

describe('computeAxiosFingerprint', () => {
  it('groups by status + normalized path', () => {
    const err = {
      isAxiosError: true,
      response: { status: 500 },
      config: { url: '/orders?perPage=10' },
    };
    expect(computeAxiosFingerprint(err)).toEqual(['axios', '500', '/orders']);
  });

  it('500 in /products vs 500 in /orders are different issues', () => {
    const a = {
      isAxiosError: true,
      response: { status: 500 },
      config: { url: '/products/cmoevheya02osrw01ijp2i4rd' },
    };
    const b = {
      isAxiosError: true,
      response: { status: 500 },
      config: { url: '/orders' },
    };
    expect(computeAxiosFingerprint(a)).not.toEqual(computeAxiosFingerprint(b));
  });

  it('500 in /products/A == 500 in /products/B (same bug, different ids)', () => {
    const a = {
      isAxiosError: true,
      response: { status: 500 },
      config: { url: '/products/cmoevheya02osrw01ijp2i4rd' },
    };
    const b = {
      isAxiosError: true,
      response: { status: 500 },
      config: { url: '/products/cmoetqrun02d8rw01ztw57zbu' },
    };
    expect(computeAxiosFingerprint(a)).toEqual(computeAxiosFingerprint(b));
  });

  it('503 vs 500 on same path = separate issues (transient infra vs bug)', () => {
    const transient = {
      isAxiosError: true,
      response: { status: 503 },
      config: { url: '/orders' },
    };
    const bug = {
      isAxiosError: true,
      response: { status: 500 },
      config: { url: '/orders' },
    };
    expect(computeAxiosFingerprint(transient)).not.toEqual(
      computeAxiosFingerprint(bug),
    );
  });

  it('returns null for non-axios errors (default Sentry grouping)', () => {
    expect(computeAxiosFingerprint(new Error('boom'))).toBeNull();
    expect(computeAxiosFingerprint(null)).toBeNull();
    expect(computeAxiosFingerprint(undefined)).toBeNull();
    expect(computeAxiosFingerprint('string')).toBeNull();
    expect(computeAxiosFingerprint(123)).toBeNull();
  });

  it('returns null for axios without status (network error / abort)', () => {

    const err = { isAxiosError: true, config: { url: '/x' } };
    expect(computeAxiosFingerprint(err)).toBeNull();
  });

  it('axios without URL in config marks as "unknown"', () => {
    const err = { isAxiosError: true, response: { status: 500 } };
    expect(computeAxiosFingerprint(err)).toEqual(['axios', '500', 'unknown']);
  });

  it('detects axios by shape even without isAxiosError flag', () => {

    const err = {
      response: { status: 500 },
      config: { url: '/orders' },
    };
    expect(computeAxiosFingerprint(err)).toEqual(['axios', '500', '/orders']);
  });

  it('doesn\'t break with malicious getter / hostile Proxy (Sentry pipeline-safe)', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('hostile getter');
        },
      },
    );
    expect(() => computeAxiosFingerprint(hostile)).not.toThrow();

  });
});

describe('extractAxiosStatus', () => {

  it('extracts numeric status from AxiosError with flag', () => {
    const err = {
      isAxiosError: true,
      response: { status: 503 },
      config: { url: '/orders' },
    };
    expect(extractAxiosStatus(err)).toBe(503);
  });

  it('extracts status by shape even without flag (wrappers that re-wrap)', () => {
    const err = { response: { status: 500 }, config: { url: '/orders' } };
    expect(extractAxiosStatus(err)).toBe(500);
  });

  it('returns null for non-axios errors', () => {
    expect(extractAxiosStatus(new Error('boom'))).toBeNull();
    expect(extractAxiosStatus({ message: 'plain object' })).toBeNull();
    expect(extractAxiosStatus(null)).toBeNull();
    expect(extractAxiosStatus(undefined)).toBeNull();
    expect(extractAxiosStatus('string')).toBeNull();
  });

  it('returns null for axios without status (network error)', () => {
    const err = { isAxiosError: true, config: { url: '/orders' } };
    expect(extractAxiosStatus(err)).toBeNull();
  });

  it('returns null if status is non-numeric', () => {
    const err = {
      isAxiosError: true,
      response: { status: '500' },
      config: { url: '/orders' },
    };
    expect(extractAxiosStatus(err)).toBeNull();
  });

  it('DOES NOT need config.url to extract status (isAxiosError flag is enough)', () => {

    const err = { isAxiosError: true, response: { status: 503 } };
    expect(extractAxiosStatus(err)).toBe(503);
  });

  it('doesn\'t break with malicious getter / hostile Proxy', () => {

    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('hostile getter');
        },
      },
    );
    expect(() => extractAxiosStatus(hostile)).not.toThrow();
    expect(extractAxiosStatus(hostile)).toBeNull();
  });
});
