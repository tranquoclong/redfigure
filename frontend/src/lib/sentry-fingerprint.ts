

const CUID_V1 = /^c[a-z0-9]{20,29}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID = /^\d+$/;

const EMAIL_LIKE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
const DOC_LIKE = /^[\d.\-/]{11,18}$/;

const MAX_URL_LEN = 1000;

function isIdSegment(seg: string): boolean {
  return (
    CUID_V1.test(seg) ||
    UUID.test(seg) ||
    NUMERIC_ID.test(seg) ||
    EMAIL_LIKE.test(seg) ||
    DOC_LIKE.test(seg)
  );
}

function safeDecodeSegment(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

export function normalizeUrlPath(rawUrl: string | undefined | null): string {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return 'unknown';

  let input: string;
  if (rawUrl.length > MAX_URL_LEN) {
    const sliced = rawUrl.slice(0, MAX_URL_LEN);
    const lastSlash = sliced.lastIndexOf('/');
    input = lastSlash > 0 ? sliced.slice(0, lastSlash) : sliced;
  } else {
    input = rawUrl;
  }

  let path: string;
  try {

    const u = new URL(input, 'http://_placeholder/');
    path = u.pathname;
  } catch {

    return '/malformed-url';
  }

  if (!path.startsWith('/')) path = '/' + path;

  return path
    .split('/')
    .map((seg) => {
      if (!seg) return seg;
      const decoded = safeDecodeSegment(seg);
      return isIdSegment(seg) || isIdSegment(decoded) ? ':id' : seg;
    })
    .join('/');
}

interface AxiosLikeError {
  isAxiosError?: unknown;
  response?: { status?: unknown } | null;
  config?: { url?: unknown } | null;
}

function safeReadAxiosShape(
  error: unknown,
): { status: number | null; url: string | null } | null {
  if (!error || typeof error !== 'object') return null;
  try {
    const e = error as AxiosLikeError;
    const rawStatus = e.response?.status;
    const rawUrl = e.config?.url;
    const status = typeof rawStatus === 'number' ? rawStatus : null;
    const url = typeof rawUrl === 'string' ? rawUrl : null;
    const isAxiosLike = e.isAxiosError === true || url !== null;
    if (!isAxiosLike) return null;
    return { status, url };
  } catch {
    return null;
  }
}

export function extractAxiosStatus(error: unknown): number | null {
  const shape = safeReadAxiosShape(error);
  return shape?.status ?? null;
}

export function computeAxiosFingerprint(error: unknown): string[] | null {
  const shape = safeReadAxiosShape(error);
  if (!shape || shape.status === null) return null;
  return ['axios', String(shape.status), normalizeUrlPath(shape.url)];
}
