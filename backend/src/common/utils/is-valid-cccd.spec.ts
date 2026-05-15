import { isValidCccd } from './is-valid-cccd';

describe('isValidCccd', () => {
  it('accepts valid CCCDs', () => {

    expect(isValidCccd('001100000001')).toBe(true);
    expect(isValidCccd('001100000002')).toBe(true);
    expect(isValidCccd('001100000003')).toBe(true);
  });

  it('rejects CCCDs with all same digits (formally valid but reserved)', () => {
    expect(isValidCccd('000000000000')).toBe(false);
    expect(isValidCccd('111111111111')).toBe(false);
    expect(isValidCccd('999999999999')).toBe(false);
  });

  it('rejects CCCDs with wrong verifier digit', () => {
    expect(isValidCccd('529982247244')).toBe(false);
    expect(isValidCccd('111111111112')).toBe(false);
    expect(isValidCccd('123456789011')).toBe(false);
  });

  it('rejects invalid format', () => {
    expect(isValidCccd('123')).toBe(false);
    expect(isValidCccd('001.100.000-11')).toBe(false);
    expect(isValidCccd('00110000000a')).toBe(false);
    expect(isValidCccd('')).toBe(false);
  });

  it('rejects non-string', () => {
    expect(isValidCccd(null as unknown as string)).toBe(false);
    expect(isValidCccd(undefined as unknown as string)).toBe(false);
    expect(isValidCccd(001100000001 as unknown as string)).toBe(false);
  });
});
