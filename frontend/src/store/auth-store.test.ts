import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isAuthError,
  __testOnly_toStoreUser,
  __testOnly_resetSyncThrottle,
  useAuthStore,
} from './auth-store';

describe('isAuthError', () => {
  describe('true cases — cleared tokens required', () => {
    it('AxiosError shape with response.status=401', () => {
      const err = {
        name: 'AxiosError',
        message: 'Request failed',
        response: { status: 401, data: {} },
      };
      expect(isAuthError(err)).toBe(true);
    });

    it('minimal response.status=401 wrapper', () => {
      expect(isAuthError({ response: { status: 401 } })).toBe(true);
    });
  });

  describe('false cases — KEEP tokens (network/transient)', () => {
    it('axios network error (no response)', () => {
      const err = {
        name: 'AxiosError',
        message: 'Network Error',
        code: 'ERR_NETWORK',
        response: undefined,
      };
      expect(isAuthError(err)).toBe(false);
    });

    it('axios timeout', () => {
      const err = {
        name: 'AxiosError',
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      };
      expect(isAuthError(err)).toBe(false);
    });

    it('backend 500', () => {
      expect(isAuthError({ response: { status: 500 } })).toBe(false);
    });

    it('backend 503', () => {
      expect(isAuthError({ response: { status: 503 } })).toBe(false);
    });

    it('backend 403 (not 401 — different semantics)', () => {

      expect(isAuthError({ response: { status: 403 } })).toBe(false);
    });

    it('other 4xx (400, 404)', () => {
      expect(isAuthError({ response: { status: 400 } })).toBe(false);
      expect(isAuthError({ response: { status: 404 } })).toBe(false);
    });
  });

  describe('defensive — non-object or empty', () => {
    it.each([null, undefined, 'error', 42, true, [], new Error('foo')])(
      'returns false for %s',
      (err) => {
        expect(isAuthError(err)).toBe(false);
      },
    );

    it('empty object', () => {
      expect(isAuthError({})).toBe(false);
    });

    it('response without status', () => {
      expect(isAuthError({ response: {} })).toBe(false);
    });

    it('response.status non-numeric', () => {
      expect(isAuthError({ response: { status: '401' } })).toBe(false);
      expect(isAuthError({ response: { status: null } })).toBe(false);
    });
  });
});

describe('toStoreUser — strip PII (Fix #5)', () => {
  it('removes cccd, phone, password, and any non-allowlist field', () => {
    const raw = {
      id: 'u1',
      email: 'test@example.com',
      name: 'Test',
      role: 'CUSTOMER',
      cccd: '001100000001',
      phone: '0901234567',
      password: 'SHOULD_NEVER_LEAK',
      internalNotes: 'admin data',
      emailMarketingOptOut: false,
    };
    const result = __testOnly_toStoreUser(raw);
    expect(result).toEqual({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test',
      role: 'CUSTOMER',
      emailMarketingOptOut: false,
    });
    expect(result).not.toHaveProperty('cccd');
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('internalNotes');
  });

  it('returns null for non-object input or without id/email', () => {
    expect(__testOnly_toStoreUser(null)).toBeNull();
    expect(__testOnly_toStoreUser(undefined)).toBeNull();
    expect(__testOnly_toStoreUser('string')).toBeNull();
    expect(__testOnly_toStoreUser({})).toBeNull();
    expect(__testOnly_toStoreUser({ id: 'x' })).toBeNull();
    expect(__testOnly_toStoreUser({ email: 'x@x.com' })).toBeNull();
  });

  it('forces invalid role to CUSTOMER (defense-in-depth)', () => {
    const result = __testOnly_toStoreUser({
      id: 'u1',
      email: 'x@x.com',
      role: 'SUPER_ADMIN',
    });
    expect(result?.role).toBe('CUSTOMER');
  });

  it('preserves legitimate ADMIN role', () => {
    const result = __testOnly_toStoreUser({
      id: 'u1',
      email: 'admin@example.com',
      role: 'ADMIN',
    });
    expect(result?.role).toBe('ADMIN');
  });

  it('optional name — preserves string, ignores other types', () => {
    expect(
      __testOnly_toStoreUser({
        id: 'u1',
        email: 'x@x.com',
        role: 'CUSTOMER',
        name: 123,
      })?.name,
    ).toBeUndefined();
  });
});

describe('accessToken in-memory (anti-XSS)', () => {

  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isHydrated: false,
    });
    localStorage.clear();
  });

  describe('login()', () => {
    it('sets accessToken in STORE (not in localStorage)', () => {
      const user = {
        id: 'u1',
        email: 'a@b.com',
        role: 'CUSTOMER' as const,
      };
      useAuthStore.getState().login(user, 'jwt-access-token-xyz');

      expect(useAuthStore.getState().accessToken).toBe('jwt-access-token-xyz');
      expect(useAuthStore.getState().user).toEqual(user);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      expect(localStorage.getItem('accessToken')).toBeNull();
    });

    it('keeps hasSession=1 in localStorage (not a token, it\'s a flag)', () => {
      useAuthStore.getState().login(
        { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' },
        'tok',
      );
      expect(localStorage.getItem('hasSession')).toBe('1');
    });

    it('clears orphan pendingLogout in localStorage', () => {
      localStorage.setItem('pendingLogout', '1');
      useAuthStore.getState().login(
        { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' },
        'tok',
      );
      expect(localStorage.getItem('pendingLogout')).toBeNull();
    });
  });

  describe('logout()', () => {
    it('clears accessToken from store + hasSession from localStorage', async () => {

      useAuthStore.setState({
        user: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' },
        accessToken: 'tok',
        isAuthenticated: true,
        isHydrated: true,
      });
      localStorage.setItem('hasSession', '1');

      vi.doMock('@/lib/api-client', () => ({
        api: { post: vi.fn().mockResolvedValue({}) },
      }));

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(localStorage.getItem('hasSession')).toBeNull();

      expect(localStorage.getItem('pendingLogout')).toBeNull();

      vi.doUnmock('@/lib/api-client');
    });

    it('keeps pendingLogout=1 if /auth/logout fails (future retry)', async () => {
      useAuthStore.setState({
        accessToken: 'tok',
        isAuthenticated: true,
      });

      vi.doMock('@/lib/api-client', () => ({
        api: { post: vi.fn().mockRejectedValue(new Error('network')) },
      }));

      await useAuthStore.getState().logout();

      expect(localStorage.getItem('pendingLogout')).toBe('1');

      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      vi.doUnmock('@/lib/api-client');
    });
  });

  describe('setAccessToken()', () => {
    it('updates accessToken without touching user/auth flags', () => {
      useAuthStore.setState({
        user: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' },
        accessToken: 'old',
        isAuthenticated: true,
      });

      useAuthStore.getState().setAccessToken('new-token');

      expect(useAuthStore.getState().accessToken).toBe('new-token');
      expect(useAuthStore.getState().user).toEqual({
        id: 'u1',
        email: 'a@b.com',
        role: 'CUSTOMER',
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('accepts null (token clear)', () => {
      useAuthStore.setState({ accessToken: 'tok' });
      useAuthStore.getState().setAccessToken(null);
      expect(useAuthStore.getState().accessToken).toBeNull();
    });

    it('NEVER writes to localStorage', () => {
      useAuthStore.getState().setAccessToken('x');
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });
});

describe('BroadcastChannel ping/fetch (anti-spoof)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isHydrated: false,
    });
    localStorage.clear();
    vi.resetModules();
    __testOnly_resetSyncThrottle();
  });

  async function setupChannelListener() {

    await useAuthStore.getState().hydrate();
  }

  it('auth_changed triggers /users/me and populates user from backend (not from payload)', async () => {

    vi.doMock('@/lib/api-client', () => ({
      api: {
        get: vi.fn().mockResolvedValue({
          data: {
            data: {
              id: 'u-real',
              email: 'real@backend.com',
              role: 'CUSTOMER',
            },
          },
        }),
        post: vi.fn(),
      },
    }));

    await setupChannelListener();
    const ch = new BroadcastChannel('redfigure-auth');
    ch.postMessage({ type: 'auth_changed' });
    await new Promise((r) => setTimeout(r, 30));
    ch.close();

    expect(useAuthStore.getState().user?.id).toBe('u-real');
    expect(useAuthStore.getState().user?.email).toBe('real@backend.com');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    vi.doUnmock('@/lib/api-client');
  });

  it('SPOOF role=ADMIN via broadcast DOES NOT elevate — backend is the truth', async () => {

    vi.doMock('@/lib/api-client', () => ({
      api: {
        get: vi.fn().mockResolvedValue({
          data: {
            data: {
              id: 'victim',
              email: 'victim@e.com',
              role: 'CUSTOMER',
            },
          },
        }),
        post: vi.fn(),
      },
    }));

    await setupChannelListener();
    const ch = new BroadcastChannel('redfigure-auth');

    ch.postMessage({
      type: 'auth_changed',
      user: { role: 'ADMIN' },
      accessToken: 'fake',
    });
    await new Promise((r) => setTimeout(r, 30));
    ch.close();

    expect(useAuthStore.getState().user?.role).toBe('CUSTOMER');
    vi.doUnmock('@/lib/api-client');
  });

  it('logout via broadcast clears store without fetch', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' },
      accessToken: 'tok',
      isAuthenticated: true,
    });
    localStorage.setItem('hasSession', '1');

    await setupChannelListener();
    const ch = new BroadcastChannel('redfigure-auth');
    ch.postMessage({ type: 'logout' });
    await new Promise((r) => setTimeout(r, 10));
    ch.close();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem('hasSession')).toBeNull();
  });

  it('rejects unknown type (spoof old login/refresh attempt)', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' },
      accessToken: 'tok',
      isAuthenticated: true,
    });

    await setupChannelListener();
    const ch = new BroadcastChannel('redfigure-auth');

    ch.postMessage({
      type: 'login',
      user: { id: 'x', email: 'x@x.com', role: 'ADMIN' },
      accessToken: 'fake-aaaaaaaaaaaaa',
    });
    ch.postMessage({ type: 'refresh', accessToken: 'fake-bbbbbbbbbbbbb' });
    ch.postMessage({ type: 'elevate' });
    await new Promise((r) => setTimeout(r, 10));
    ch.close();

    expect(useAuthStore.getState().user?.role).toBe('CUSTOMER');
    expect(useAuthStore.getState().accessToken).toBe('tok');
  });

  it('rejects non-object payload (string/null) without crash', async () => {
    await setupChannelListener();
    const ch = new BroadcastChannel('redfigure-auth');
    ch.postMessage('auth_changed');
    ch.postMessage(null);
    ch.postMessage(42);
    await new Promise((r) => setTimeout(r, 10));
    ch.close();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('auth_changed with /me 401 clears store (session really ended)', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' },
      accessToken: 'tok',
      isAuthenticated: true,
    });
    localStorage.setItem('hasSession', '1');

    vi.doMock('@/lib/api-client', () => ({
      api: {
        get: vi.fn().mockRejectedValue({ response: { status: 401 } }),
        post: vi.fn(),
      },
    }));

    await setupChannelListener();
    const ch = new BroadcastChannel('redfigure-auth');
    ch.postMessage({ type: 'auth_changed' });
    await new Promise((r) => setTimeout(r, 30));
    ch.close();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem('hasSession')).toBeNull();
    vi.doUnmock('@/lib/api-client');
  });

  it('NETWORK error preserves state (Gemini R3: no logoff on internet blip)', async () => {

    vi.doMock('@/lib/api-client', () => ({
      api: {
        get: vi.fn().mockRejectedValue({
          name: 'AxiosError',
          code: 'ERR_NETWORK',
          message: 'Network Error',
        }),
        post: vi.fn(),
      },
    }));

    await setupChannelListener();

    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' },
      accessToken: 'tok',
      isAuthenticated: true,
    });
    localStorage.setItem('hasSession', '1');

    const ch = new BroadcastChannel('redfigure-auth');
    ch.postMessage({ type: 'auth_changed' });
    await new Promise((r) => setTimeout(r, 30));
    ch.close();

    expect(useAuthStore.getState().user?.email).toBe('a@b.com');
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(localStorage.getItem('hasSession')).toBe('1');
    vi.doUnmock('@/lib/api-client');
  });

  it('500 error preserves state (Gemini R3: no logoff on backend down)', async () => {
    vi.doMock('@/lib/api-client', () => ({
      api: {
        get: vi.fn().mockRejectedValue({ response: { status: 500 } }),
        post: vi.fn(),
      },
    }));

    await setupChannelListener();
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' },
      accessToken: 'tok',
      isAuthenticated: true,
    });
    localStorage.setItem('hasSession', '1');

    const ch = new BroadcastChannel('redfigure-auth');
    ch.postMessage({ type: 'auth_changed' });
    await new Promise((r) => setTimeout(r, 30));
    ch.close();

    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    vi.doUnmock('@/lib/api-client');
  });

  it('hydrate uses Web Locks (navigator.locks) to serialize /refresh cross-tab', async () => {

    localStorage.setItem('hasSession', '1');

    const lockedSections: string[] = [];
    const lockMock = vi.fn().mockImplementation(
      async (name: string, fn: () => Promise<unknown>) => {
        lockedSections.push(`enter:${name}`);
        const result = await fn();
        lockedSections.push(`exit:${name}`);
        return result;
      },
    );

    Object.defineProperty(globalThis, 'navigator', {
      value: { locks: { request: lockMock } },
      configurable: true,
    });

    const postMock = vi.fn().mockResolvedValue({
      data: { data: { accessToken: 'tok' } },
    });
    const getMock = vi.fn().mockResolvedValue({
      data: { data: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' } },
    });
    vi.doMock('@/lib/api-client', () => ({
      api: { post: postMock, get: getMock },
    }));

    await useAuthStore.getState().hydrate();

    expect(lockMock).toHaveBeenCalled();
    expect(lockedSections[0]).toMatch(/^enter:/);
    expect(lockedSections[lockedSections.length - 1]).toMatch(/^exit:/);
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    delete (globalThis as { navigator?: unknown }).navigator;
    vi.doUnmock('@/lib/api-client');
  });

  it('hydrate fallback without navigator.locks (old Safari): behavior equals current path', async () => {

    localStorage.setItem('hasSession', '1');

    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
    });

    const postMock = vi.fn().mockResolvedValue({
      data: { data: { accessToken: 'tok' } },
    });
    const getMock = vi.fn().mockResolvedValue({
      data: { data: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' } },
    });
    vi.doMock('@/lib/api-client', () => ({
      api: { post: postMock, get: getMock },
    }));

    await useAuthStore.getState().hydrate();

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    delete (globalThis as { navigator?: unknown }).navigator;
    vi.doUnmock('@/lib/api-client');
  });

  it('hydrate with 401 TOKEN_ROTATED: retries ONCE without clearing hasSession (multi-tab race)', async () => {

    localStorage.setItem('hasSession', '1');

    const refreshErr = {
      response: { status: 401, data: { errorCode: 'TOKEN_ROTATED' } },
    };
    let refreshCalls = 0;
    const postMock = vi.fn().mockImplementation(() => {
      refreshCalls++;
      if (refreshCalls === 1) return Promise.reject(refreshErr);

      return Promise.resolve({ data: { data: { accessToken: 'new-tok' } } });
    });
    const getMock = vi.fn().mockResolvedValue({
      data: { data: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' } },
    });
    vi.doMock('@/lib/api-client', () => ({
      api: { post: postMock, get: getMock },
    }));

    await useAuthStore.getState().hydrate();

    expect(postMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('hasSession')).toBe('1');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.id).toBe('u1');
    vi.doUnmock('@/lib/api-client');
  });

  it('hydrate with 401 TOKEN_EXPIRED: clears hasSession (truly dead session)', async () => {

    localStorage.setItem('hasSession', '1');

    const postMock = vi.fn().mockRejectedValue({
      response: { status: 401, data: { errorCode: 'TOKEN_EXPIRED' } },
    });
    vi.doMock('@/lib/api-client', () => ({
      api: { post: postMock, get: vi.fn() },
    }));

    await useAuthStore.getState().hydrate();

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('hasSession')).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    vi.doUnmock('@/lib/api-client');
  });

  it('hydrate with 401 TOKEN_REUSE: clears hasSession (revoked family)', async () => {
    localStorage.setItem('hasSession', '1');

    const postMock = vi.fn().mockRejectedValue({
      response: { status: 401, data: { errorCode: 'TOKEN_REUSE' } },
    });
    vi.doMock('@/lib/api-client', () => ({
      api: { post: postMock, get: vi.fn() },
    }));

    await useAuthStore.getState().hydrate();

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('hasSession')).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    vi.doUnmock('@/lib/api-client');
  });

  it('hydrate retry of TOKEN_ROTATED fails again: clears hasSession (no infinite loop)', async () => {
    localStorage.setItem('hasSession', '1');

    const refreshErr = {
      response: { status: 401, data: { errorCode: 'TOKEN_ROTATED' } },
    };
    const postMock = vi.fn().mockRejectedValue(refreshErr);
    vi.doMock('@/lib/api-client', () => ({
      api: { post: postMock, get: vi.fn() },
    }));

    await useAuthStore.getState().hydrate();

    expect(postMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('hasSession')).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    vi.doUnmock('@/lib/api-client');
  });

  it('THROTTLE: 100 broadcasts in sequence trigger only 1 fetch (Gemini R3: anti-DDoS XSS)', async () => {
    const getMock = vi.fn().mockResolvedValue({
      data: { data: { id: 'u1', email: 'a@b.com', role: 'CUSTOMER' } },
    });
    vi.doMock('@/lib/api-client', () => ({
      api: { get: getMock, post: vi.fn() },
    }));

    await setupChannelListener();
    const ch = new BroadcastChannel('redfigure-auth');

    for (let i = 0; i < 100; i++) {
      ch.postMessage({ type: 'auth_changed' });
    }
    await new Promise((r) => setTimeout(r, 50));
    ch.close();

    expect(getMock).toHaveBeenCalledTimes(1);
    vi.doUnmock('@/lib/api-client');
  });
});
