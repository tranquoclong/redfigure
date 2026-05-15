
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback = '/',
): string {
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    return fallback;
  }

  if (!candidate.startsWith('/')) return fallback;

  const BASE = 'http://localhost';
  let url: URL;
  try {
    url = new URL(candidate, BASE);
  } catch {
    return fallback;
  }

  if (url.origin !== BASE) return fallback;

  let pathToValidate = url.pathname;
  try {
    let previous = '';
    let i = 0;
    while (pathToValidate !== previous && i < 5) {
      previous = pathToValidate;
      pathToValidate = decodeURIComponent(pathToValidate);
      i++;
    }
  } catch {
    return fallback;
  }

  pathToValidate = pathToValidate.normalize('NFKC');

  if (/[\x00-\x1F\x7F]/.test(pathToValidate)) return fallback;
  if (!pathToValidate.startsWith('/')) return fallback;
  if (pathToValidate.startsWith('//') || pathToValidate.startsWith('/\\')) {
    return fallback;
  }

  try {
    const recheck = new URL(pathToValidate, BASE);
    if (recheck.origin !== BASE) return fallback;
    if (
      recheck.pathname.startsWith('//') ||
      recheck.pathname.startsWith('/\\')
    ) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return url.pathname + url.search + url.hash;
}
