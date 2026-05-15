import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const NO_CACHE_PATHS = [
  '/my-account',
  '/cart',
  '/checkout',
  '/admin',
];

const FORWARDED_HEADERS = [
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-port',
];

function normalizeOriginHeader(headers: Headers): boolean {
  const v = headers.get('origin');
  if (!v || !v.includes(',')) return false;

  const parts = v.split(',').map((p) => p.trim()).filter(Boolean);
  const allIdentical = parts.every((p) => p === parts[0]);

  if (allIdentical && parts[0]) {
    headers.set('origin', parts[0]);
  } else {

    headers.delete('origin');
  }
  return true;
}

function normalizeForwardedHeaders(headers: Headers): boolean {
  let normalized = false;
  for (const name of FORWARDED_HEADERS) {
    const v = headers.get(name);
    if (v && v.includes(',')) {
      const first = v.split(',')[0]!.trim();
      if (first) headers.set(name, first);
      normalized = true;
    }
  }
  return normalized;
}

function normalizeProxyHeaders(headers: Headers): boolean {
  const a = normalizeOriginHeader(headers);
  const b = normalizeForwardedHeaders(headers);
  return a || b;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const proxyHeaders = new Headers(request.headers);
  const wasNormalized = normalizeProxyHeaders(proxyHeaders);

  const requestInit = wasNormalized ? { request: { headers: proxyHeaders } } : undefined;

  const shouldPreventCache = NO_CACHE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (shouldPreventCache) {
    const response = NextResponse.next(requestInit);
    response.headers.set(
      'Cache-Control',
      'private, no-store, no-cache, must-revalidate',
    );
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    return response;
  }

  return NextResponse.next(requestInit);
}

export const config = {
  matcher: [

    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
