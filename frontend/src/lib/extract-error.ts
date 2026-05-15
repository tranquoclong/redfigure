import { reportError } from './error-reporter';
import { maskPII } from './pii-scrubber';

export function extractError(err: unknown, context?: string): string {
  let rawMessage = 'Lỗi không xác định';
  let usedFallback = false;

  const axiosResp = (
    err as {
      response?: {
        data?: {
          error?: { message?: string; details?: string[] };
          message?: string;
        };
        status?: number;
      };
    }
  )?.response;

  if (axiosResp?.data?.error?.details?.length) {
    rawMessage = axiosResp.data.error.details.join(', ');
  } else if (axiosResp?.data?.error?.message) {
    rawMessage = axiosResp.data.error.message;
  } else if (axiosResp?.data?.message) {
    rawMessage = axiosResp.data.message;
  } else if (err instanceof Error && err.message) {
    rawMessage = err.message;
  } else if (typeof err === 'string' && err) {
    rawMessage = err;
  } else {
    usedFallback = true;
  }

  const safeMessage = maskPII(rawMessage);

  const sanitized = sanitizeForReport(err, safeMessage, context);
  const status = axiosResp?.status;

  const reportMessage = usedFallback
    ? `extractError fallback (${typeof err}): ${maskPII(safeStringify(err)).slice(0, 200)}`
    : safeMessage;

  reportError(
    {
      type: 'unhandled',
      message: reportMessage,
      status,
      url: typeof window !== 'undefined' ? window.location.pathname : undefined,
      timestamp: Date.now(),
    },
    sanitized,
  );

  return safeMessage;
}

function sanitizeForReport(err: unknown, safeMessage: string, context?: string): Error {
  const name = err instanceof Error ? err.constructor.name : 'UnknownError';
  const e = new Error(safeMessage);
  e.name = name;
  if (err instanceof Error && err.stack) {

    e.stack = maskPII(err.stack);
  }
  if (context) {
    (e as Error & { context?: string }).context = context;
  }
  return e;
}

export function extractApiError(err: unknown, fallback: string): string {
  const message = extractError(err);
  return message === 'Lỗi không xác định' ? fallback : message;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (key, v) => {

      if (key === '') return v;
      if (v === null || typeof v !== 'object') return v;
      return '[Object]';
    });
  } catch {
    return '[unserializable]';
  }
}
