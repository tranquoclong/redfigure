import {
  computeLedgerHash,
  canonicalizeLedgerRow,
  LedgerHashInput,
} from './affiliate-ledger-hash';

describe('affiliate-ledger-hash', () => {
  const SECRET = 'test-secret-key-32-bytes-min-xxx';

  describe('canonicalizeLedgerRow', () => {
    it('produces deterministic string with fixed-order fields', () => {
      const row: LedgerHashInput = {
        id: 'entry-1',
        affiliateId: 'aff-1',
        type: 'CREDIT',
        source: 'COMMISSION',
        amount: '10.00',
        orderId: 'order-1',
        commissionId: 'c-1',
        paymentId: null,
        reason: null,
        createdByUserId: null,
        createdAt: new Date('2026-04-24T00:00:00.000Z'),
      };
      const s1 = canonicalizeLedgerRow(row);
      const s2 = canonicalizeLedgerRow(row);
      expect(s1).toBe(s2);

      expect(s1).toContain('entry-1');
      expect(s1).toContain('aff-1');
      expect(s1).toContain('CREDIT');
      expect(s1).toContain('10.00');
    });

    it('null is preserved as "null" in JSON (does not convert to "") — Gemini R2 mutation', () => {

      const rowNull: LedgerHashInput = {
        id: 'e1',
        affiliateId: 'a1',
        type: 'DEBIT',
        source: 'PAYMENT',
        amount: '5.00',
        orderId: null,
        commissionId: null,
        paymentId: 'p1',
        reason: null,
        createdByUserId: 'admin',
        createdAt: new Date('2026-04-24'),
      };
      const rowEmpty = { ...rowNull, orderId: '', commissionId: '' };
      expect(canonicalizeLedgerRow(rowNull)).not.toBe(
        canonicalizeLedgerRow(rowEmpty),
      );

      expect(canonicalizeLedgerRow(rowNull)).toContain('null');
    });

    it('amount is normalized via toFixed(2) — "10" and "10.00" yield same canonical', () => {
      const base: LedgerHashInput = {
        id: 'e1',
        affiliateId: 'a1',
        type: 'CREDIT',
        source: 'COMMISSION',
        amount: '10',
        orderId: null,
        commissionId: null,
        paymentId: null,
        reason: null,
        createdByUserId: null,
        createdAt: new Date('2026-04-24'),
      };
      expect(canonicalizeLedgerRow(base)).toBe(
        canonicalizeLedgerRow({ ...base, amount: '10.00' }),
      );
      expect(canonicalizeLedgerRow(base)).toBe(
        canonicalizeLedgerRow({ ...base, amount: '10.000' }),
      );
    });

    it('invalid amount (non-numeric) throws', () => {
      const row: LedgerHashInput = {
        id: 'e1',
        affiliateId: 'a1',
        type: 'CREDIT',
        source: 'COMMISSION',
        amount: 'abc',
        orderId: null,
        commissionId: null,
        paymentId: null,
        reason: null,
        createdByUserId: null,
        createdAt: new Date('2026-04-24'),
      };
      expect(() => canonicalizeLedgerRow(row)).toThrow(/Invalid amount/);
    });

    it('different rows produce different canonicals', () => {
      const base: LedgerHashInput = {
        id: 'e1',
        affiliateId: 'a1',
        type: 'CREDIT',
        source: 'COMMISSION',
        amount: '10.00',
        orderId: 'o1',
        commissionId: 'c1',
        paymentId: null,
        reason: null,
        createdByUserId: null,
        createdAt: new Date('2026-04-24'),
      };
      const altered = { ...base, amount: '10.01' };
      expect(canonicalizeLedgerRow(base)).not.toBe(
        canonicalizeLedgerRow(altered),
      );
    });
  });

  describe('computeLedgerHash', () => {
    const row: LedgerHashInput = {
      id: 'e1',
      affiliateId: 'a1',
      type: 'CREDIT',
      source: 'COMMISSION',
      amount: '10.00',
      orderId: 'o1',
      commissionId: 'c1',
      paymentId: null,
      reason: null,
      createdByUserId: null,
      createdAt: new Date('2026-04-24T00:00:00Z'),
    };

    it('returns 64-char hex (sha256)', () => {
      const h = computeLedgerHash(row, null, SECRET);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('deterministic - same input + same prev + same secret', () => {
      const h1 = computeLedgerHash(row, null, SECRET);
      const h2 = computeLedgerHash(row, null, SECRET);
      expect(h1).toBe(h2);
    });

    it('DIFFERENT prevHash changes the resulting hash (chain property)', () => {
      const h1 = computeLedgerHash(row, null, SECRET);
      const h2 = computeLedgerHash(row, 'a'.repeat(64), SECRET);
      expect(h1).not.toBe(h2);
    });

    it('DIFFERENT secret changes the hash (HMAC property)', () => {
      const h1 = computeLedgerHash(row, null, SECRET);
      const h2 = computeLedgerHash(row, null, 'other-secret-123');
      expect(h1).not.toBe(h2);
    });

    it('DIFFERENT row changes the hash (tampering detection)', () => {
      const h1 = computeLedgerHash(row, 'prev-hash', SECRET);
      const tampered = { ...row, amount: '999.00' };
      const h2 = computeLedgerHash(tampered, 'prev-hash', SECRET);
      expect(h1).not.toBe(h2);
    });

    it('throws if secret is empty or undefined', () => {
      expect(() => computeLedgerHash(row, null, '')).toThrow();
      expect(() => computeLedgerHash(row, null, undefined as any)).toThrow();
    });
  });
});
