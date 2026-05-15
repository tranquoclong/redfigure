import * as Sentry from '@sentry/nestjs';

export type BullErrorSource = 'job_failed' | 'worker_error' | 'queue_error';

interface BullJobLike {
  id?: string | number | undefined;
  name?: string | undefined;
}

export function captureBullError(
  err: unknown,
  source: BullErrorSource,
  worker: string,
  job?: BullJobLike,
): void {
  Sentry.captureException(err, {
    tags: {
      worker,
      bullmq_source: source,
      ...(job?.name ? { job_name: job.name } : {}),
    },
    extra: {
      job_id: job?.id != null ? String(job.id) : null,
    },
  });
}
