import type { Response } from 'express';

const IS_PROD = process.env.NODE_ENV === 'production';
export const REFRESH_COOKIE_NAME = IS_PROD
  ? '__Host-refresh_token'
  : 'refresh_token';
export const REFRESH_COOKIE_PATH = IS_PROD ? '/' : '/api/v1/auth';
const PERSISTENT_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function baseOptions() {
  return {
    httpOnly: true,

    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict' as const,
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  persistent: boolean,
): void {
  const opts: Record<string, unknown> = { ...baseOptions() };
  if (persistent) {
    opts.maxAge = PERSISTENT_COOKIE_MAX_AGE_MS;
  }

  res.cookie(REFRESH_COOKIE_NAME, token, opts);
}

export function clearRefreshCookie(res: Response): void {

  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions());
}

export const OAUTH_STATE_COOKIE_NAME = 'oauth_state';
const OAUTH_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

const OAUTH_STATE_SECURE = process.env.NODE_ENV !== 'development';

export function setOAuthStateCookie(res: Response, payload: string): void {
  res.cookie(OAUTH_STATE_COOKIE_NAME, payload, {
    httpOnly: true,
    secure: OAUTH_STATE_SECURE,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE_MS,
  });
}

export function clearOAuthStateCookie(res: Response): void {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
    httpOnly: true,
    secure: OAUTH_STATE_SECURE,
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
}
