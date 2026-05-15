
export function isInternalRequest(headers: Record<string, unknown>): boolean {
  const expected = process.env.INTERNAL_REQUEST_TOKEN;
  if (!expected) return false;

  const got = headers['x-internal-request'];
  if (typeof got !== 'string') return false;

  return got === expected;
}
