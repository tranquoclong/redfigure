import { describe, it, expect } from 'vitest';
import { maskPII } from './pii-scrubber';

describe('maskPII', () => {
  it('masks CCCD with mask', () => {
    expect(maskPII('CCCD 123.456.789-00 already registered')).toBe(
      'CCCD [CCCD_REDACTED] already registered',
    );
  });

  it('masks CCCD without mask', () => {
    expect(maskPII('user 12345678900 not found')).toBe(
      'user [CCCD_REDACTED] not found',
    );
  });

  it('masks email', () => {
    expect(maskPII('Email john.doe@example.com invalid')).toBe(
      'Email [EMAIL_REDACTED] invalid',
    );
  });

  it('masks MST', () => {
    expect(maskPII('MST 12.345.678/0001-90 invalid')).toBe(
      'MST [MST_REDACTED] invalid',
    );
  });

  it('masks credit card', () => {
    expect(maskPII('card 4111 1111 1111 1111 declined')).toBe(
      'card [CARD_REDACTED] declined',
    );
  });

  it('masks sensitive query strings (token, email, password)', () => {
    const stack = 'Error: at /confirmar?token=abc123&email=foo@bar.com:42';
    const out = maskPII(stack);
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('foo@bar.com');
    expect(out).toContain('token=[REDACTED]');
  });

  it('preserves utm_* and other non-sensitive params (signal)', () => {
    const url = '/products?utm_source=google&page=2';
    expect(maskPII(url)).toBe(url);
  });

  it('masks VN phone', () => {
    const out = maskPII('phone (84) 0863403552 not found');
    expect(out).not.toContain('0863403552');
    expect(out).toContain('[PHONE_REDACTED]');
  });

  it('preserves message without PII', () => {
    expect(maskPII('Error saving footer')).toBe('Error saving footer');
  });

  it('masks password in JSON body (axios config.data serialized)', () => {
    const stack = 'Error: {"email":"x@y.com","password":"hunter2","token":"abc123"}';
    const out = maskPII(stack);
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('abc123');
    expect(out).toContain('password');
    expect(out).toContain('[REDACTED]');
  });

  it('masks util.inspect format (unquoted key + single quote value)', () => {
    const stack = "Error in { password: 'hunter2', email: 'x@y.com' }";
    const out = maskPII(stack);
    expect(out).not.toContain('hunter2');
  });

  it('masks PHP-style query array (?password[]=)', () => {
    const url = '/login?password[]=hunter2&user=x';
    const out = maskPII(url);
    expect(out).not.toContain('hunter2');
    expect(out).toContain('[REDACTED]');
  });

  it('masks indexed array query (?token[0]=, ?key[access]=)', () => {
    expect(maskPII('?token[0]=secret123')).not.toContain('secret123');
    expect(maskPII('?token[access]=secret456')).not.toContain('secret456');
  });

  it('masks key prefix/suffix (user_password, csrf_token)', () => {
    expect(maskPII('?user_password=hunter2')).not.toContain('hunter2');
    expect(maskPII('?csrf_token=abc')).not.toContain('abc');
    const json = '{"user_password":"hunter2","auth_token":"xyz"}';
    const out = maskPII(json);
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('xyz');
  });

  it('truncates giant input (ReDoS defense)', () => {
    const huge = 'a'.repeat(10000);
    const out = maskPII(huge);
    expect(out.length).toBeLessThan(6000);
    expect(out).toContain('[TRUNCATED]');
  });

  it('50KB hard cap prevents event loop block (DoS defense)', () => {
    const huge = 'b'.repeat(100000);
    const out = maskPII(huge);

    expect(out.length).toBeLessThan(6000);
    expect(out).toContain('[TRUNCATED]');
  });

  it('handles empty/null safely', () => {
    expect(maskPII('')).toBe('');
  });
});
