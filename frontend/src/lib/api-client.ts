import axios from 'axios';
import { API_URL, API_TIMEOUT } from './constants';

const BASE_URL =
  typeof window === 'undefined'
    ? (process.env.INTERNAL_API_URL ?? API_URL)
    : API_URL;

const AXIOS_BASE_URL = `${BASE_URL}/api/v1`;

export const api = axios.create({
  baseURL: AXIOS_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },

  withCredentials: true,

  maxRedirects: 0,
});

export function isSameOriginRequest(
  configUrl: string | undefined,
  configBaseUrl: string | undefined,
  trustedBaseUrl: string,
): boolean {
  try {
    const activeBase = configBaseUrl || trustedBaseUrl;
    const urlToEval = configUrl ?? '';
    const target = new URL(urlToEval, activeBase);
    const trustedBase = new URL(trustedBaseUrl);

    return target.origin === trustedBase.origin;
  } catch {
    return false;
  }
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = localStorage.getItem('sessionId');
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem('sessionId', sid);
  }
  return sid;
}

const INTERNAL_REQUEST_TOKEN =
  typeof window === 'undefined' ? process.env.INTERNAL_REQUEST_TOKEN : undefined;

const SENSITIVE_HEADERS = [
  'authorization',
  'x-session-id',
  'x-internal-request',
] as const;

export function __testOnly_stripSensitiveHeaders(headers: unknown): void {
  stripSensitiveHeaders(headers);
}

function setHeader(headers: unknown, name: string, value: string): void {
  if (!headers) return;
  const h = headers as Record<string, unknown> & {
    set?: (n: string, v: string) => void;
  };
  if (typeof h.set === 'function') {
    h.set(name, value);
  } else {
    h[name] = value;
  }
}

function stripSensitiveHeaders(headers: unknown): void {
  if (!headers) return;
  const h = headers as Record<string, unknown> & {
    delete?: (n: string) => void;
  };

  if (typeof h.delete === 'function') {
    for (const name of SENSITIVE_HEADERS) h.delete(name);
    return;
  }

  for (const key of Object.keys(h)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase() as typeof SENSITIVE_HEADERS[number])) {
      delete h[key];
    }
  }
}

api.interceptors.request.use((config) => {

  const sameOrigin = isSameOriginRequest(
    config.url,
    config.baseURL,
    AXIOS_BASE_URL,
  );

  if (sameOrigin) {
    if (typeof window !== 'undefined') {

      let token: string | null = null;
      try {

        const mod = require('@/store/auth-store') as {
          useAuthStore: { getState: () => { accessToken: string | null } };
        };
        token = mod.useAuthStore.getState().accessToken;
      } catch {
        token = null;
      }
      if (token) {
        setHeader(config.headers, 'Authorization', `Bearer ${token}`);
      }
      setHeader(config.headers, 'x-session-id', getSessionId());
    } else if (INTERNAL_REQUEST_TOKEN) {

      setHeader(config.headers, 'x-internal-request', INTERNAL_REQUEST_TOKEN);
    }
  } else {

    stripSensitiveHeaders(config.headers);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  let setAccessToken: ((token: string | null) => void) | null = null;
  let broadcastRefresh: (() => void) | null = null;
  try {

    const mod = require('@/store/auth-store') as {
      useAuthStore: {
        getState: () => {
          setAccessToken: (token: string | null) => void;
        };
      };
    };
    setAccessToken = mod.useAuthStore.getState().setAccessToken;
    broadcastRefresh = () => {

      const ch =
        typeof BroadcastChannel !== 'undefined'
          ? new BroadcastChannel('redfigure-auth')
          : null;
      if (ch) {
        ch.postMessage({ type: 'auth_changed' });
        ch.close();
      }
    };
  } catch {

  }

  try {

    const { data } = await axios.post(
      `${BASE_URL}/api/v1/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const newAccess = data.data.accessToken;
    if (setAccessToken) setAccessToken(newAccess);
    if (broadcastRefresh) broadcastRefresh();
    return newAccess;
  } catch {

    if (setAccessToken) setAccessToken(null);
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (typeof window !== 'undefined' && typeof status === 'number') {

      const { reportError, isReportableHttpStatus } = require('./error-reporter') as typeof import('./error-reporter');
      if (isReportableHttpStatus(status)) {
        reportError(
          {
            type: 'http',
            message: error.message ?? `HTTP ${status}`,
            url: originalRequest?.url,
            status,
            timestamp: Date.now(),
          },
          error,
        );
      }
    }

    if (typeof window === 'undefined' || status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    const clearStoreToken = () => {
      try {

        const mod = require('@/store/auth-store') as {
          useAuthStore: {
            getState: () => {
              setAccessToken: (token: string | null) => void;
            };
          };
        };
        mod.useAuthStore.getState().setAccessToken(null);
      } catch {

      }
    };

    if (originalRequest.url?.includes('/auth/refresh')) {
      clearStoreToken();
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      clearStoreToken();
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newAccess = await refreshPromise;

    if (!newAccess) {

      return Promise.reject(error);
    }

    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${newAccess}`;
    return api(originalRequest);
  },
);
