import { isInternalRequest } from './is-internal-request';

describe('isInternalRequest', () => {
  const ORIGINAL_TOKEN = process.env.INTERNAL_REQUEST_TOKEN;

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.INTERNAL_REQUEST_TOKEN;
    else process.env.INTERNAL_REQUEST_TOKEN = ORIGINAL_TOKEN;
  });

  it('returns false when INTERNAL_REQUEST_TOKEN is not defined (fail-closed)', () => {
    delete process.env.INTERNAL_REQUEST_TOKEN;
    expect(isInternalRequest({ 'x-internal-request': 'qualquer' })).toBe(false);
  });

  it('returns false when INTERNAL_REQUEST_TOKEN is empty (fail-closed)', () => {
    process.env.INTERNAL_REQUEST_TOKEN = '';
    expect(isInternalRequest({ 'x-internal-request': 'qualquer' })).toBe(false);
  });

  it('returns true when header matches env', () => {
    process.env.INTERNAL_REQUEST_TOKEN = 'token-secreto-123';
    expect(
      isInternalRequest({ 'x-internal-request': 'token-secreto-123' }),
    ).toBe(true);
  });

  it('returns false when header does not match', () => {
    process.env.INTERNAL_REQUEST_TOKEN = 'token-secreto-123';
    expect(isInternalRequest({ 'x-internal-request': 'token-errado' })).toBe(
      false,
    );
  });

  it('returns false when header is missing', () => {
    process.env.INTERNAL_REQUEST_TOKEN = 'token-secreto-123';
    expect(isInternalRequest({})).toBe(false);
  });

  it('returns false when header is array (attacker sending multiple)', () => {
    process.env.INTERNAL_REQUEST_TOKEN = 'token-secreto-123';
    expect(
      isInternalRequest({ 'x-internal-request': ['token-secreto-123', 'x'] }),
    ).toBe(false);
  });

  it('returns false when header is undefined', () => {
    process.env.INTERNAL_REQUEST_TOKEN = 'token-secreto-123';
    expect(isInternalRequest({ 'x-internal-request': undefined })).toBe(false);
  });
});
