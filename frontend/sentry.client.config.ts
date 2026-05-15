import * as Sentry from '@sentry/nextjs';
import { isReportableHttpStatus, setSink } from '@/lib/error-reporter';
import {
  computeAxiosFingerprint,
  extractAxiosStatus,
} from '@/lib/sentry-fingerprint';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENV || 'production',
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    tracesSampleRate: 0.03,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],

    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
    ],

    beforeSend(event, hint) {
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          event.request.url = `${u.origin}${u.pathname}`;
        } catch { }
      }
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.data;
      }
      const orig = hint?.originalException;
      const axiosStatus = extractAxiosStatus(orig);
      if (axiosStatus !== null && !isReportableHttpStatus(axiosStatus)) {
        return null;
      }
      const axiosFp = computeAxiosFingerprint(orig);
      if (axiosFp) event.fingerprint = axiosFp;
      return event;
    },
  });

  setSink((event, originalError) => {
    Sentry.captureException(originalError ?? new Error(event.message), {
      tags: {
        capture_type: event.type,
        ...(typeof event.status === 'number' ? { http_status: String(event.status) } : {}),
      },
      extra: {
        url: event.url,
        timestamp: event.timestamp,
      },
    });
  });
}
