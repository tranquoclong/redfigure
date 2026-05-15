

export const SLOW_QUERY_WARN_MS = 300;
export const SLOW_QUERY_ERROR_MS = 1000;

interface SlowLogger {
  warn(payload: Record<string, unknown>, msg?: string): void;
  error(payload: Record<string, unknown>, msg?: string): void;
}

interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface SentryBreadcrumb {
  category: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

type AddBreadcrumb = (b: SentryBreadcrumb) => void;

export function handleSlowQuery(
  event: PrismaQueryEvent,
  logger: SlowLogger,
  addBreadcrumb?: AddBreadcrumb,
): void {
  if (event.duration < SLOW_QUERY_WARN_MS) return;

  const isError = event.duration >= SLOW_QUERY_ERROR_MS;
  const payload = {
    duration_ms: event.duration,
    target: event.target,
    query: event.query,
  };

  if (isError) {
    logger.error(payload, 'slow_query');
  } else {
    logger.warn(payload, 'slow_query');
  }

  if (addBreadcrumb) {
    try {
      addBreadcrumb({
        category: 'prisma.slow_query',
        level: isError ? 'error' : 'warning',
        message: `slow query ${event.duration}ms on ${event.target}`,
        data: payload,
      });
    } catch {

    }
  }
}
