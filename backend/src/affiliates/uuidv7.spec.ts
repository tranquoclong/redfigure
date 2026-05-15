import { uuidv7 } from './uuidv7';

describe('uuidv7', () => {
  it('gera string com formato UUID (36 chars, 4 hifens)', () => {
    const id = uuidv7();
    expect(id).toHaveLength(36);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('sets version=7 at the 13th char (first of 3rd group)', () => {
    const id = uuidv7();

    expect(id.charAt(14)).toBe('7');
  });

  it('sets variant=RFC4122 (10xx) at the 17th char', () => {
    const id = uuidv7();

    const variantChar = id.charAt(19);
    expect('89ab').toContain(variantChar);
  });

  it('IDs generated in sequence are monotonically increasing (lexicographic)', () => {
    const ids: string[] = [];

    const t0 = Date.now();
    while (Date.now() === t0) {

    }
    for (let i = 0; i < 10; i++) {
      ids.push(uuidv7());

      const start = Date.now();
      while (Date.now() - start < 2) {

      }
    }
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('two consecutive calls (same ms) generate different IDs', () => {
    const a = uuidv7();
    const b = uuidv7();
    expect(a).not.toBe(b);
  });

  it('timestamp prefix matches Date.now() (first 48 bits)', () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();

    const hex = id.slice(0, 8) + id.slice(9, 13);
    const tsMs = parseInt(hex, 16);
    expect(tsMs).toBeGreaterThanOrEqual(before);
    expect(tsMs).toBeLessThanOrEqual(after);
  });
});
