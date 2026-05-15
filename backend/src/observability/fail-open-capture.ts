import * as Sentry from '@sentry/nestjs';

export function captureFailOpen(
  err: unknown,
  op: string,
  extra?: Record<string, unknown>,
): void {
  Sentry.captureException(err, {
    tags: {
      fail_open: 'true',
      op,
    },
    extra: extra ?? {},
  });
}
