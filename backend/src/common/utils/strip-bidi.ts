
const INVISIBLE_CODEPOINTS = [
  0x061c, 0x115f, 0x1160, 0x200b, 0x200c, 0x200e, 0x200f, 0x202a, 0x202b,
  0x202c, 0x202d, 0x202e, 0x2060, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
  0x2800, 0x3164, 0xffa0,
] as const;

const INVISIBLE_RE = new RegExp(
  `[${INVISIBLE_CODEPOINTS.map((cp) => String.fromCodePoint(cp)).join('')}]`,
  'g',
);

export function stripBidi(input: string): string {
  return input.replace(INVISIBLE_RE, '');
}
