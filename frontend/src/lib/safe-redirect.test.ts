import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  describe('valid internal paths', () => {
    it.each([
      '/',
      '/my-account',
      '/my-account/orders',
      '/admin',
      '/p/product-slug',
      '/search?q=miniature',
      '/products?cat=1&sort=price',
      '/my-account#addresses',
    ])('accepts %s', (candidate) => {
      expect(safeRedirectPath(candidate, '/')).toBe(candidate);
    });
  });

  describe('open redirect attack vectors — MUST reject', () => {
    it.each([
      '//evil.com',
      '//evil.com/phish',
      '//redfigure.com.evil.com',
      'https://evil.com',
      'http://evil.com',
      'HTTPS://evil.com',
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      '/\\evil.com',
      '\\\\evil.com',
      '\\/evil.com',
      '//\\evil.com',
      '//@evil.com',
      'evil.com',
      'my-account',
      '',
      '   ',

      '/%2fevil.com',
      '/%2Fevil.com',
      '/%5cevil.com',
      '/%5Cevil.com',

      '/\t//evil.com',
      '/\n//evil.com',
      '/\r//evil.com',

      '/..//evil.com',
      '/../..//evil.com',
      '/%255Cevil.com',
      '/%25252F/evil.com',
      '/%00//evil.com',
      '/\x00//evil.com',
      '/\x7F//evil.com',

      '/\uFF0Fevil.com',
      '/\uFF0F\uFF0Fevil.com',
    ])('rejects %s → fallback', (candidate) => {
      expect(safeRedirectPath(candidate, '/fallback')).toBe('/fallback');
    });
  });

  describe('preserves legitimate query and hash encoding (Gemini round 4)', () => {
    it('does not destroy %3F inside query param value', () => {

      expect(safeRedirectPath('/login?redirect=/dashboard%3Ftab%3D1')).toBe(
        '/login?redirect=/dashboard%3Ftab%3D1',
      );
    });

    it('preserves %20 (encoded space) in search', () => {
      expect(safeRedirectPath('/search?q=hello%20world')).toBe(
        '/search?q=hello%20world',
      );
    });

    it('preserves encoded chars in hash', () => {
      expect(safeRedirectPath('/p/slug#section-%C3%A1ncora')).toBe(
        '/p/slug#section-%C3%A1ncora',
      );
    });
  });

  describe('null / undefined', () => {
    it('returns fallback for null', () => {
      expect(safeRedirectPath(null, '/fallback')).toBe('/fallback');
    });

    it('returns fallback for undefined', () => {
      expect(safeRedirectPath(undefined, '/fallback')).toBe('/fallback');
    });
  });

  describe('default fallback', () => {
    it('uses / when fallback not provided', () => {
      expect(safeRedirectPath(null)).toBe('/');
      expect(safeRedirectPath('//evil.com')).toBe('/');
    });
  });

  describe('edge cases', () => {
    it('normalizes paths through URL parser', () => {

      const result = safeRedirectPath('/./foo', '/fallback');
      expect(result.startsWith('/')).toBe(true);
      expect(result).not.toContain('evil');
    });

    it('rejects non-string input', () => {

      expect(safeRedirectPath(123, '/fallback')).toBe('/fallback');

      expect(safeRedirectPath({}, '/fallback')).toBe('/fallback');
    });

    it('preserves query string and hash on valid paths', () => {
      expect(safeRedirectPath('/x?a=1&b=2', '/')).toBe('/x?a=1&b=2');
      expect(safeRedirectPath('/x#section', '/')).toBe('/x#section');
      expect(safeRedirectPath('/x?a=1#section', '/')).toBe('/x?a=1#section');
    });

    it('handles encoded slash attacks (%2F%2Fevil.com)', () => {

      const result = safeRedirectPath('/%2F%2Fevil.com', '/fallback');

      expect(result.startsWith('/')).toBe(true);

      expect(result).not.toMatch(/^\/\//);
    });
  });
});
