import { stripBidi } from './strip-bidi';

const RTL_OVERRIDE = String.fromCodePoint(0x202e);
const ZWS = String.fromCodePoint(0x200b);
const ZWNJ = String.fromCodePoint(0x200c);
const ZWJ = String.fromCodePoint(0x200d);
const BOM = String.fromCodePoint(0xfeff);
const HANGUL_FILLER = String.fromCodePoint(0x3164);

describe('stripBidi', () => {
  it('remove RTL override', () => {
    expect(stripBidi(`hello${RTL_OVERRIDE}world`)).toBe('helloworld');
  });

  it('remove zero-width space', () => {
    expect(stripBidi(`foo${ZWS}bar`)).toBe('foobar');
  });

  it('remove zero-width non-joiner (preserves ZWJ for compound emojis)', () => {
    expect(stripBidi(`a${ZWNJ}b`)).toBe('ab');
    expect(stripBidi(`a${ZWJ}b`)).toBe(`a${ZWJ}b`);
  });

  it('preserves normal text with accents and punctuation', () => {
    expect(stripBidi('Acai - Sao Paulo, 75mm.')).toBe(
      'Acai - Sao Paulo, 75mm.',
    );
  });

  it('remove BOM (U+FEFF)', () => {
    expect(stripBidi(`${BOM}test`)).toBe('test');
  });

  it('remove Hangul filler (U+3164)', () => {
    expect(stripBidi(`text${HANGUL_FILLER}here`)).toBe('texthere');
  });

  it('preserves empty string', () => {
    expect(stripBidi('')).toBe('');
  });
});
