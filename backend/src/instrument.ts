
import * as Sentry from '@sentry/nestjs';
import { redactObject } from './common/utils/log-redact';

const dsn = process.env.SENTRY_DSN;

const BOOT_TIMESTAMP = Date.now();
const BOOT_FRAGILITY_MS = 60_000;

const DB_UNREACHABLE_PATTERNS = [
  /Can't reach database server/i,
  /Connection refused/i,
  /ECONNREFUSED/i,
];

function isBootFragilityWindow(): boolean {
  return Date.now() - BOOT_TIMESTAMP < BOOT_FRAGILITY_MS;
}

function isTransientDbError(message: string | undefined): boolean {
  if (!message) return false;
  return DB_UNREACHABLE_PATTERNS.some((p) => p.test(message));
}

function getPathOnly(url: string | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'http://dummy.local');
    return parsed.pathname.replace(/\/$/, '') || '/';
  } catch {
    return '';
  }
}

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION,

    tracesSampler: (samplingContext) => {

      const path = getPathOnly(samplingContext.normalizedRequest?.url);
      if (path === '/api/health' || path === '/api/health/ready') return 0;
      if (path.startsWith('/api/v1/_debug/')) return 0;
      return parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.03');
    },

    beforeSend(event) {

      const path = getPathOnly(event.request?.url);
      if (path === '/api/health' || path === '/api/health/ready') {
        return null;
      }

      if (isBootFragilityWindow()) {
        const message =
          event.exception?.values?.[0]?.value ?? event.message ?? '';
        if (isTransientDbError(message)) {
          return null;
        }
      }

      return redactObject(event);
    },

    beforeBreadcrumb(breadcrumb) {
      return redactObject(breadcrumb);
    },

    ignoreErrors: [
      'BadRequestException',
      'UnauthorizedException',
      'ForbiddenException',
      'NotFoundException',
      'ConflictException',
      'ThrottlerException',
    ],
  });
}
