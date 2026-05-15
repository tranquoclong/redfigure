import type { Response } from 'express';
import {
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} from './cookie.helper';

function makeRes(): { res: Response; cookieCalls: any[]; clearCalls: any[] } {
  const cookieCalls: any[] = [];
  const clearCalls: any[] = [];
  const res = {
    cookie: (name: string, value: string, options: any) => {
      cookieCalls.push({ name, value, options });
      return res;
    },
    clearCookie: (name: string, options: any) => {
      clearCalls.push({ name, options });
      return res;
    },
  } as unknown as Response;
  return { res, cookieCalls, clearCalls };
}

describe('cookie.helper — refresh cookie persistent flag', () => {
  it('setRefreshCookie(persistent=true): cookie WITH maxAge 30d', () => {
    const { res, cookieCalls } = makeRes();
    setRefreshCookie(res, 'tok', true);
    expect(cookieCalls).toHaveLength(1);
    const call = cookieCalls[0];
    expect(call.name).toBe(REFRESH_COOKIE_NAME);
    expect(call.value).toBe('tok');
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(call.options.maxAge).toBe(thirtyDaysMs);
    expect(call.options.httpOnly).toBe(true);
  });

  it('setRefreshCookie(persistent=false): cookie WITHOUT maxAge (session cookie)', () => {
    const { res, cookieCalls } = makeRes();
    setRefreshCookie(res, 'tok', false);
    expect(cookieCalls).toHaveLength(1);
    const call = cookieCalls[0];

    expect(call.options.maxAge).toBeUndefined();

    expect(call.options.httpOnly).toBe(true);
    expect(call.options.sameSite).toBe('strict');
  });

  it('clearRefreshCookie: Use the SAME base flags (path/sameSite/secure) for the browser to accept the clear.', () => {
    const { res, clearCalls } = makeRes();
    clearRefreshCookie(res);
    expect(clearCalls).toHaveLength(1);
    const call = clearCalls[0];
    expect(call.name).toBe(REFRESH_COOKIE_NAME);
    expect(call.options.httpOnly).toBe(true);
    expect(call.options.sameSite).toBe('strict');
  });
});
