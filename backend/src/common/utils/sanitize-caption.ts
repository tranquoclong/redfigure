
export function sanitizeCaption(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const bounded = raw.length > 2000 ? raw.slice(0, 2000) : raw;
  const cleaned = bounded
    .normalize('NFC')

    .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
    .replace(
      /[\u061C\u115F\u1160\u200B\u200C\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF\u2800\u3164\uFFA0]/g,
      '',
    )
    .replace(/(\p{M}{2})\p{M}+/gu, '$1')
    .trim();
  if (cleaned.length === 0) return null;
  const segmenter = new Intl.Segmenter('vi-VN', { granularity: 'grapheme' });
  const graphemes: string[] = [];
  for (const seg of segmenter.segment(cleaned)) {
    if (graphemes.length >= 200) break;
    graphemes.push(seg.segment);
  }
  return graphemes.join('');
}
