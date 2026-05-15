import { sanitizeCaption } from './sanitize-caption';

describe('sanitizeCaption', () => {
  it('returns null for non-strings (anti-prototype-pollution)', () => {
    expect(sanitizeCaption(undefined)).toBeNull();
    expect(sanitizeCaption(null)).toBeNull();
    expect(sanitizeCaption(123)).toBeNull();
    expect(sanitizeCaption({})).toBeNull();
    expect(sanitizeCaption([])).toBeNull();
  });

  it('trims and keeps valid content', () => {
    expect(sanitizeCaption('  Imagem ilustrativa  ')).toBe(
      'Imagem ilustrativa',
    );
  });

  it('returns null for empty/whitespace', () => {
    expect(sanitizeCaption('')).toBeNull();
    expect(sanitizeCaption('   ')).toBeNull();
  });

  it('caps at 200 characters', () => {
    const long = 'a'.repeat(500);
    expect(sanitizeCaption(long)?.length).toBe(200);
  });

  it('strips bidi/zero-width/word-joiner (anti-UI-spoof)', () => {
    expect(sanitizeCaption('Hello\u202E world\u200B\u2060')).toBe(
      'Hello world',
    );
  });

  it('strips C0 + C1 control chars', () => {

    expect(sanitizeCaption('foo\x01bar\x85baz')).toBe('foo bar baz');
  });

  it('preserves ZWJ-joined emojis (family, skin tone)', () => {
    const family = '👨\u200D👩\u200D👧\u200D👦';
    expect(sanitizeCaption(`Familia ${family}`)).toBe(`Familia ${family}`);
  });

  it('does not split surrogate pairs at boundary', () => {
    const caption = '🚀'.repeat(150);
    const result = sanitizeCaption(caption);
    expect(result).toBe(caption);
    expect(result?.includes('\uFFFD')).toBe(false);
  });

  it('rejects captions composed only of invisible bypass chars', () => {
    expect(sanitizeCaption('\u2800\u2800\u3164')).toBeNull();
    expect(sanitizeCaption('\u115F\u1160\uFFA0')).toBeNull();
  });

  it('normalizes NFC', () => {

    const decomposed = 'caf\u0065\u0301';
    const result = sanitizeCaption(decomposed);
    expect(result?.normalize('NFC')).toBe(result);
    expect(result).toBe('café');
  });

  it('caps combining marks', () => {
    const zalgo = 'a' + '\u0301'.repeat(100) + 'b';
    const result = sanitizeCaption(zalgo);
    const marks = result?.match(/\p{M}/gu) ?? [];
    expect(marks.length).toBeLessThanOrEqual(2);
  });

  it('bounds raw input at 2000 chars (DoS protection)', () => {

    const huge = 'x'.repeat(10_000);
    expect(sanitizeCaption(huge)?.length).toBeLessThanOrEqual(200);
  });
});
