'use client';

import { create } from 'zustand';
import { z } from 'zod';
import type { User } from '@/types/user';

const StoreUserSchema = z
  .object({

    id: z.string().min(1).max(255),

    email: z.string().email().max(255),
    name: z.string().max(255).optional(),
    role: z.enum(['ADMIN', 'CUSTOMER']).catch('CUSTOMER'),
    emailMarketingOptOut: z.boolean().optional(),
    isOwner: z.boolean().catch(false).optional(),
  })
  .strip();

function toStoreUser(raw: unknown): User | null {
  const result = StoreUserSchema.safeParse(raw);
  if (!result.success) {

    if (typeof console !== 'undefined' && console.warn) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[auth-store] User sanitization failed:',
          result.error.format(),
        );
      } else {
        const failedFields = result.error.issues
          .map((issue) => issue.path.join('.'))
          .join(', ');
        console.warn(
          `[auth-store] Sanitization failed for fields: ${failedFields}`,
        );
      }
    }
    return null;
  }
  return result.data;
}

export const __testOnly_toStoreUser = toStoreUser;

export function isAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const maybe = err as { response?: { status?: unknown } };
  return maybe.response?.status === 401;
}

interface AuthState {
  user: User | null;

  accessToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  login: (user: User, accessToken: string) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

type AuthBroadcastMsg =
  | { type: 'auth_changed' }
  | { type: 'logout' };

const BroadcastMsgSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auth_changed') }),
  z.object({ type: z.literal('logout') }),
]);

let _channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!_channel) {
    _channel = new BroadcastChannel('redfigure-auth');
  }
  return _channel;
}

function broadcastAuth(msg: AuthBroadcastMsg): void {
  const ch = getChannel();
  if (ch) ch.postMessage(msg);
}

let _lastSyncAt = 0;
const SYNC_THROTTLE_MS = 500;

export function __testOnly_resetSyncThrottle(): void {
  if (process.env.NODE_ENV !== 'test') return;
  _lastSyncAt = 0;
}

async function syncFromBackend(): Promise<void> {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - _lastSyncAt < SYNC_THROTTLE_MS) return;
  _lastSyncAt = now;

  try {
    const { api } = await import('@/lib/api-client');
    const { data } = await api.get('/users/me');
    const raw = data.data ?? data;
    const user = toStoreUser(raw);
    if (user) {
      useAuthStore.setState({
        user,
        isAuthenticated: true,
        isHydrated: true,
      });
      localStorage.setItem('hasSession', '1');
    } else {

      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isHydrated: true,
      });
    }
  } catch (err) {

    if (isAuthError(err)) {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isHydrated: true,
      });
      localStorage.removeItem('hasSession');
    }
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isHydrated: false,

  setUser: (user) => {
    const sanitized = user ? toStoreUser(user) : null;
    set({ user: sanitized, isAuthenticated: !!sanitized });
  },

  setAccessToken: (token) => {
    set({ accessToken: token });
  },

  login: (user, accessToken) => {

    localStorage.setItem('hasSession', '1');

    localStorage.removeItem('pendingLogout');
    set({ user, accessToken, isAuthenticated: true, isHydrated: true });

    broadcastAuth({ type: 'auth_changed' });
  },

  logout: async () => {

    localStorage.setItem('pendingLogout', '1');
    try {
      const { api } = await import('@/lib/api-client');
      await api.post('/auth/logout');
      localStorage.removeItem('pendingLogout');
    } catch {

    }
    localStorage.removeItem('hasSession');
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isHydrated: true,
    });
    broadcastAuth({ type: 'logout' });
  },

  hydrate: async () => {
    if (get().isHydrated) return;

    if (typeof window === 'undefined') {
      set({ isHydrated: true });
      return;
    }

    const ch = getChannel();
    if (ch && !ch.onmessage) {
      ch.onmessage = (ev: MessageEvent<unknown>) => {

        const result = BroadcastMsgSchema.safeParse(ev.data);
        if (!result.success) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[auth-store] Invalid broadcast message dropped:',
              result.error.format(),
            );
          }
          return;
        }
        const msg = result.data;
        if (msg.type === 'auth_changed') {

          void syncFromBackend();
        } else if (msg.type === 'logout') {

          useAuthStore.setState({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isHydrated: true,
          });
          localStorage.removeItem('hasSession');
        }
      };
    }

    if (localStorage.getItem('pendingLogout') === '1') {
      let retrySucceeded = false;
      try {
        const { api } = await import('@/lib/api-client');
        await api.post('/auth/logout');
        retrySucceeded = true;
      } catch {

      }
      if (retrySucceeded) {
        localStorage.removeItem('pendingLogout');
      }
      localStorage.removeItem('hasSession');
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isHydrated: true,
      });
      return;
    }

    const hasSession = localStorage.getItem('hasSession') === '1';

    if (!hasSession) {
      set({ isHydrated: true });
      return;
    }

    function getErrorCode(err: unknown): string | null {
      if (!err || typeof err !== 'object') return null;
      const maybe = err as { response?: { data?: { errorCode?: unknown } } };
      const code = maybe.response?.data?.errorCode;
      return typeof code === 'string' ? code : null;
    }

    async function doRefresh(): Promise<string | null> {
      try {
        const { api } = await import('@/lib/api-client');
        const { data } = await api.post('/auth/refresh', {});
        return data.data?.accessToken ?? null;
      } catch (err) {
        if (getErrorCode(err) === 'TOKEN_ROTATED') {
          await new Promise((r) => setTimeout(r, 300));
          try {
            const { api } = await import('@/lib/api-client');
            const { data } = await api.post('/auth/refresh', {});
            return data.data?.accessToken ?? null;
          } catch {
            return null;
          }
        }
        return null;
      }
    }

    type LockApi = {
      request: (
        name: string,
        cb: () => Promise<string | null>,
      ) => Promise<string | null>;
    };
    const locks = (
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & { locks?: LockApi }).locks
        : undefined
    );

    let accessToken: string | null = null;
    if (locks) {

      accessToken = await locks.request('redfigure-auth-refresh', doRefresh);
    } else {

      const LOCK_KEY = 'redfigure_refresh_lock';
      const LOCK_TTL_MS = 5_000;
      const now = Date.now();
      const lockTime = parseInt(localStorage.getItem(LOCK_KEY) ?? '0', 10);
      if (now - lockTime > LOCK_TTL_MS) {

        localStorage.setItem(LOCK_KEY, String(now));
        try {
          accessToken = await doRefresh();
        } finally {
          localStorage.removeItem(LOCK_KEY);
        }
      } else {

        await new Promise((r) => setTimeout(r, 1000));
        try {
          const { api } = await import('@/lib/api-client');
          const { data } = await api.get('/users/me');
          const raw = data.data ?? data;
          const user = toStoreUser(raw);
          set({ user, isAuthenticated: !!user, isHydrated: true });
          if (user) broadcastAuth({ type: 'auth_changed' });
        } catch {
          localStorage.removeItem('hasSession');
          set({ isHydrated: true });
        }
        return;
      }
    }

    if (!accessToken) {

      localStorage.removeItem('hasSession');
      set({ isHydrated: true });
      return;
    }

    set({ accessToken });

    try {
      const { api } = await import('@/lib/api-client');
      const { data } = await api.get('/users/me');
      const raw = data.data ?? data;
      const user = toStoreUser(raw);
      set({ user, isAuthenticated: !!user, isHydrated: true });
      if (user) {

        broadcastAuth({ type: 'auth_changed' });
      }
    } catch (err) {
      if (isAuthError(err)) {
        localStorage.removeItem('hasSession');
        set({ accessToken: null });
      }
      set({ user: null, isAuthenticated: false, isHydrated: true });
    }
  },
}));
