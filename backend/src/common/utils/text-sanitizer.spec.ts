import { sanitizeText } from './text-sanitizer';

describe('sanitizeText', () => {
  describe('HTML stripping', () => {
    it('removes simple HTML tags', () => {
      expect(sanitizeText('<b>bold</b> text')).toBe('bold text');
    });

    it('removes self-closing tags', () => {
      expect(sanitizeText('line1<br/>line2')).toBe('line1line2');
    });

    it('removes script tags (XSS)', () => {
      expect(sanitizeText('<script>alert(1)</script>hi')).toBe('hi');
    });

    it('removes nested/overlapping HTML (scr<script>ipt tricks)', () => {

      const out = sanitizeText('<scr<script>ipt>alert(1)</script>oi');
      expect(out).not.toMatch(/[<>]/);
      expect(out).not.toContain('alert');
      expect(out).not.toContain('script');
      expect(out).toContain('oi');
    });

    it('removes stray angle brackets without pairs', () => {
      expect(sanitizeText('5 > 3 and 2 < 4')).toBe('5 3 and 2 4');
    });

    it('removes malformed HTML with attributes', () => {
      expect(sanitizeText('<a href="evil">click</a>me')).toBe('clickme');
    });
  });

  describe('URL stripping', () => {
    it('replaces https URL with [link removido]', () => {
      expect(sanitizeText('veja em https://evil.com/x aqui')).toBe(
        'veja em [link removido] aqui',
      );
    });

    it('replaces http URL', () => {
      expect(sanitizeText('http://spam.ru/bad')).toBe('[link removido]');
    });

    it('replaces www. URL', () => {
      expect(sanitizeText('acesse www.spam.com/bad hoje')).toBe(
        'acesse [link removido] hoje',
      );
    });

    it('replaces mailto: links', () => {
      expect(sanitizeText('email mailto:x@y.com direto')).toBe(
        'email [link removido] direto',
      );
    });

    it('case-insensitive URL match', () => {
      expect(sanitizeText('HTTPS://foo.com')).toBe('[link removido]');
    });
  });

  describe('whitespace normalization', () => {
    it('trims leading/trailing whitespace', () => {
      expect(sanitizeText('   hi   ')).toBe('hi');
    });

    it('collapses multiple spaces', () => {
      expect(sanitizeText('a    b')).toBe('a b');
    });

    it('collapses tabs to single space', () => {
      expect(sanitizeText('a\t\tb')).toBe('a b');
    });

    it('preserves up to 2 consecutive newlines', () => {
      expect(sanitizeText('a\n\n\n\n\nb')).toBe('a\n\nb');
    });

    it('preserves single newline', () => {
      expect(sanitizeText('a\nb')).toBe('a\nb');
    });
  });

  describe('control character removal', () => {
    it('strips NULL bytes', () => {
      expect(sanitizeText('a\x00b')).toBe('ab');
    });

    it('strips \\r', () => {
      expect(sanitizeText('a\rb')).toBe('ab');
    });

    it('strips other control chars but keeps \\n and \\t', () => {

      expect(sanitizeText('a\x08\x0Bb\nc')).toBe('ab\nc');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for null/undefined/empty', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null as unknown as string)).toBe('');
      expect(sanitizeText(undefined as unknown as string)).toBe('');
    });

    it('handles input that becomes empty after stripping', () => {
      expect(sanitizeText('<script></script>')).toBe('');
      expect(sanitizeText('   <br/>   ')).toBe('');
    });

    it('preserves Unicode / accents', () => {
      expect(sanitizeText('Ask with action and heart.')).toBe(
        'Ask with action and heart.',
      );
    });
  });
});
