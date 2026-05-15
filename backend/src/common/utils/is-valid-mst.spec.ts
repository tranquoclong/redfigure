import { isValidMST } from './is-valid-mst';

function generateValidMST(base9: string, branch: string = ''): string {
  if (!/^\d{9}$/.test(base9)) {
    throw new Error('base must be 9 digits [0-9]');
  }

  const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += Number(base9[i]) * weights[i];
  }

  let checkDigit = 10 - (sum % 11);
  if (checkDigit === 10) checkDigit = 0;

  return `${base9}${checkDigit}${branch}`;
}

describe('isValidMST', () => {
  describe('10-digit MST (Công ty mẹ / Cá nhân)', () => {
    it('accepts valid MST', () => {
      expect(isValidMST('0101234565')).toBe(true);
    });

    it('accepts valid MST generated dynamically', () => {
      expect(isValidMST(generateValidMST('031234567'))).toBe(true);
      expect(isValidMST(generateValidMST('010999888'))).toBe(true);
    });

    it('rejects wrong verifier digit', () => {
      expect(isValidMST('0101234567')).toBe(false);
      expect(isValidMST('0101234560')).toBe(false);
    });
  });

  describe('13-digit MST (Chi nhánh / Văn phòng đại diện)', () => {
    it('accepts valid 13-digit MST (liền mạch)', () => {
      const valid = generateValidMST('010123456', '001');
      expect(valid).toMatch(/^\d{13}$/);
      expect(isValidMST(valid)).toBe(true);
    });

    it('accepts valid 13-digit MST (có dấu gạch ngang)', () => {
      const valid = generateValidMST('010123456', '-002');
      expect(isValidMST(valid)).toBe(true);
    });

    it('rejects 13-digit MST with invalid base verifier', () => {
      expect(isValidMST('0101234567001')).toBe(false);
      expect(isValidMST('0101234567-001')).toBe(false);
    });
  });

  describe('Formal Rejections', () => {
    it('rejects invalid format/length', () => {
      expect(isValidMST('123')).toBe(false);
      expect(isValidMST('01012345650')).toBe(false);
      expect(isValidMST('010123456500')).toBe(false);
      expect(isValidMST('01012345650001')).toBe(false);
      expect(isValidMST('')).toBe(false);
    });

    it('rejects non-string types', () => {
      expect(isValidMST(null as unknown as string)).toBe(false);
      expect(isValidMST(undefined as unknown as string)).toBe(false);
      expect(isValidMST(101234565 as unknown as string)).toBe(false);
    });

    it('rejects invalid characters (letters/symbols)', () => {
      expect(isValidMST('010123456A')).toBe(false);
      expect(isValidMST('010A234565')).toBe(false);
      expect(isValidMST('01 1234565')).toBe(false);
      expect(isValidMST('C101234565')).toBe(false);
    });
  });
});