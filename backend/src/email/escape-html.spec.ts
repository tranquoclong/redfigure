import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it.each([
    ['<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
    ['Tom & Jerry', 'Tom &amp; Jerry'],
    ['"hello"', '&quot;hello&quot;'],
    [`it's`, 'it&#39;s'],
    ['`backtick`', '&#96;backtick&#96;'],
    ['<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;'],
    ['<<nested>>', '&lt;&lt;nested&gt;&gt;'],
  ])('escapes %s', (input, expected) => {
    expect(escapeHtml(input)).toBe(expected);
  });

  it('preserves plain text unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles null/undefined → empty string', () => {
    expect(escapeHtml(null as unknown as string)).toBe('');
    expect(escapeHtml(undefined as unknown as string)).toBe('');
  });

  it('coerces non-strings to string before escaping', () => {
    expect(escapeHtml(123 as unknown as string)).toBe('123');
    expect(escapeHtml(true as unknown as string)).toBe('true');
  });

  it('escapes & first to prevent double-escape', () => {

    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});
