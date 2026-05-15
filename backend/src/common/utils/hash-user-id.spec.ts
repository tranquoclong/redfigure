import { hashUserId } from './hash-user-id';

describe('hashUserId', () => {
  it('returns undefined when userId empty/undefined', () => {
    expect(hashUserId(undefined, 'salt')).toBeUndefined();
    expect(hashUserId('', 'salt')).toBeUndefined();
    expect(hashUserId(null as unknown as string, 'salt')).toBeUndefined();
  });

  it('returns undefined when salt empty (fail-closed for LGPD)', () => {
    expect(hashUserId('user-123', '')).toBeUndefined();
    expect(
      hashUserId('user-123', undefined as unknown as string),
    ).toBeUndefined();
  });

  it('returns 16 chars hex hash (truncated)', () => {
    const result = hashUserId('user-123', 'test-salt-1234567890');
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it('deterministic - same input returns same hash', () => {
    const a = hashUserId('user-123', 'salt-abc');
    const b = hashUserId('user-123', 'salt-abc');
    expect(a).toBe(b);
  });

  it('different salts produce different hashes (anti-rainbow)', () => {
    const a = hashUserId('user-123', 'salt-A');
    const b = hashUserId('user-123', 'salt-B');
    expect(a).not.toBe(b);
  });

  it('different userIds with same salt produce different hashes', () => {
    const a = hashUserId('user-123', 'shared-salt');
    const b = hashUserId('user-456', 'shared-salt');
    expect(a).not.toBe(b);
  });
});
