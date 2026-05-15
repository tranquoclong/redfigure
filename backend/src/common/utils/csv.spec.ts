import { csvEscapeField, csvFromRows, csvRow } from './csv';

describe('csvEscapeField (anti-injection)', () => {
  it('null/undefined → empty string', () => {
    expect(csvEscapeField(null)).toBe('');
    expect(csvEscapeField(undefined)).toBe('');
  });

  it('normal strings without special chars → unchanged', () => {
    expect(csvEscapeField('hello')).toBe('hello');
    expect(csvEscapeField(42)).toBe('42');
  });

  it('prefixa = with apostrophe (formula injection)', () => {
    expect(csvEscapeField('=SUM(A1:A10)')).toBe(`'=SUM(A1:A10)`);
  });

  it('prefixa + with apostrophe', () => {
    expect(csvEscapeField('+cmd')).toBe(`'+cmd`);
  });

  it('prefixa - with apostrophe (negative num could be formula too)', () => {
    expect(csvEscapeField('-5+1')).toBe(`'-5+1`);
  });

  it('prefixa @ with apostrophe (DDE)', () => {
    expect(csvEscapeField('@import')).toBe(`'@import`);
  });

  it('prefixa tab with apostrophe (alternative DDE trigger)', () => {
    expect(csvEscapeField('\tfoo')).toBe(`'\tfoo`);
  });

  it('wrap + escape quotes if contains quotes', () => {
    expect(csvEscapeField('he said "hi"')).toBe(`"he said ""hi"""`);
  });

  it('wrap if contains comma', () => {
    expect(csvEscapeField('a,b,c')).toBe('"a,b,c"');
  });

  it('strip newline before escape (anti-bypass DDE multi-line)', () => {
    expect(csvEscapeField('line1\nline2')).toBe('line1 line2');
  });

  it('prevents bypass: "John\n=formula" does not escape the prefix check', () => {

    const input = 'John\n=IMPORTXML("evil","a")';
    const out = csvEscapeField(input);

    expect(out).not.toMatch(/[\r\n]/);

    expect(out).not.toMatch(/\n=/);
    expect(out).toContain('John');
  });

  it('combines prefix + wrap in attacker case', () => {

    const input = '=HYPERLINK("evil","click")';
    expect(csvEscapeField(input)).toBe(`"'=HYPERLINK(""evil"",""click"")"`);
  });
});

describe('csvRow/csvFromRows', () => {
  it('concatenates fields with comma', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('builds complete CSV with header + rows, CRLF separator', () => {
    const csv = csvFromRows(
      ['Name', 'Value'],
      [
        ['=bad', 100],
        ['safe', 200],
      ],
    );
    expect(csv).toBe(`Name,Value\r\n'=bad,100\r\nsafe,200`);
  });
});
