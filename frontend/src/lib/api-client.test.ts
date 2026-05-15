import { describe, it, expect } from 'vitest';
import {
  isSameOriginRequest,
  __testOnly_stripSensitiveHeaders,
} from './api-client';

const BASE = 'http://localhost:4000/api/v1';

describe('isSameOriginRequest', () => {
  describe('relative URLs — same origin', () => {
    it.each([
      '/products',
      '/auth/login',
      '/users/me',
      'products',
      '/orders?page=1',
    ])('accepts %s', (url) => {
      expect(isSameOriginRequest(url, undefined, BASE)).toBe(true);
    });

    it('accepts undefined (uses baseURL)', () => {
      expect(isSameOriginRequest(undefined, undefined, BASE)).toBe(true);
    });

    it('accepts empty string (uses baseURL)', () => {
      expect(isSameOriginRequest('', undefined, BASE)).toBe(true);
    });
  });

  describe('absolute URL with same origin — attach token', () => {
    it.each([
      'http://localhost:4000/api/v1/x',
      'http://localhost:4000/anything',
    ])('accepts %s', (url) => {
      expect(isSameOriginRequest(url, undefined, BASE)).toBe(true);
    });
  });

  describe('external URLs — DO NOT attach token', () => {
    it.each([
      'https://evil.com',
      'http://evil.com',
      'https://evil.com/api',
      '//evil.com/api',
      '//localhost.evil.com',
      'https://localhost.evil.com:4000/api/v1',
      'http://localhost:9999/api/v1',
      'https://localhost:4000/api/v1',
      'javascript:alert(1)',
      'data:text/html,x',
    ])('rejects %s', (url) => {
      expect(isSameOriginRequest(url, undefined, BASE)).toBe(false);
    });
  });

  describe('Gemini round 2 — whitespace/backslash/baseURL override bypasses', () => {
    it('rejects leading space + external (URL parser strips whitespace)', () => {
      expect(
        isSameOriginRequest(' https://evil.com/steal', undefined, BASE),
      ).toBe(false);
    });

    it('rejects leading newline + external', () => {
      expect(
        isSameOriginRequest('\nhttps://evil.com', undefined, BASE),
      ).toBe(false);
    });

    it('rejects leading tab + external', () => {
      expect(
        isSameOriginRequest('\thttps://evil.com', undefined, BASE),
      ).toBe(false);
    });

    it('rejects baseURL override to external (bypass critical)', () => {
      expect(
        isSameOriginRequest('/api/users', 'https://evil.com', BASE),
      ).toBe(false);
    });

    it('rejects baseURL override even when url is empty', () => {
      expect(isSameOriginRequest('', 'https://evil.com', BASE)).toBe(false);
    });

    it('accepts baseURL override to same origin', () => {
      expect(
        isSameOriginRequest('/x', 'http://localhost:4000', BASE),
      ).toBe(true);
    });

    it('single backslash resolves to path in current origin (safe)', () => {

      expect(isSameOriginRequest('\\evil.com', undefined, BASE)).toBe(true);
    });

    it('rejects double backslash (equivalent to //evil.com)', () => {

      expect(
        isSameOriginRequest('\\\\evil.com', undefined, BASE),
      ).toBe(false);
    });
  });

  describe('malformed input', () => {
    it('rejects garbage that looks like absolute URL', () => {
      expect(isSameOriginRequest('http://', undefined, BASE)).toBe(false);
      expect(
        isSameOriginRequest('https://[invalid', undefined, BASE),
      ).toBe(false);
    });
  });

  describe('stripSensitiveHeaders — case-insensitive (Gemini round 3)', () => {
    it('removes canonical headers', () => {
      const headers: Record<string, string> = {
        Authorization: 'Bearer leaky',
        'x-session-id': 'sess',
        'x-internal-request': 'internal',
        'Content-Type': 'application/json',
      };
      __testOnly_stripSensitiveHeaders(headers);
      expect(headers.Authorization).toBeUndefined();
      expect(headers['x-session-id']).toBeUndefined();
      expect(headers['x-internal-request']).toBeUndefined();
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('removes lowercase authorization (HTTP spec: names case-insensitive)', () => {
      const headers: Record<string, string> = {
        authorization: 'Bearer leaky-lowercase',
      };
      __testOnly_stripSensitiveHeaders(headers);
      expect(headers.authorization).toBeUndefined();
    });

    it('removes mixed-case X-SESSION-ID', () => {
      const headers: Record<string, string> = {
        'X-SESSION-ID': 'sess',
      };
      __testOnly_stripSensitiveHeaders(headers);
      expect(headers['X-SESSION-ID']).toBeUndefined();
    });

    it('uses AxiosHeaders.delete() when available', () => {
      const calls: string[] = [];
      const fakeAxiosHeaders = {
        Authorization: 'Bearer leaky',
        delete(name: string) {
          calls.push(name);
        },
      };
      __testOnly_stripSensitiveHeaders(fakeAxiosHeaders);
      expect(calls).toContain('authorization');
      expect(calls).toContain('x-session-id');
      expect(calls).toContain('x-internal-request');
    });

    it('no-ops on null/undefined headers', () => {
      expect(() => __testOnly_stripSensitiveHeaders(null)).not.toThrow();
      expect(() =>
        __testOnly_stripSensitiveHeaders(undefined),
      ).not.toThrow();
    });
  });

  describe('production baseURL (HTTPS)', () => {
    const PROD = 'https://redfigure.com/api/v1';

    it('accepts same origin', () => {
      expect(
        isSameOriginRequest('https://redfigure.com/x', undefined, PROD),
      ).toBe(true);
    });

    it('rejects HTTP downgrade', () => {
      expect(
        isSameOriginRequest('http://redfigure.com/x', undefined, PROD),
      ).toBe(false);
    });

    it('rejects subdomain', () => {
      expect(
        isSameOriginRequest(
          'https://evil.redfigure.com/x',
          undefined,
          PROD,
        ),
      ).toBe(false);
    });

    it('rejects prefix confusion', () => {
      expect(
        isSameOriginRequest(
          'https://redfigure.com.evil.com/x',
          undefined,
          PROD,
        ),
      ).toBe(false);
    });
  });
});
