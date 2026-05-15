import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { randomUUID } from 'crypto';
import { hashUserId } from '../utils/hash-user-id';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {
    this.logger.setContext('HTTP');
  }

  private routeOf(request: { route?: { path?: string } }): string {

    return request.route?.path ?? 'UNMATCHED_ROUTE';
  }

  private safeUrlForLog(rawUrl: string | undefined): string {

    if (!rawUrl) return 'unknown';
    const qIdx = rawUrl.indexOf('?');
    return qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const traceId = randomUUID();
    const startedAt = Date.now();

    request.traceId = traceId;
    const response = context.switchToHttp().getResponse();
    if (response?.setHeader) {
      response.setHeader('x-trace-id', traceId);
    }

    const userHash = hashUserId(
      request.user?.id ?? request.user?.sub,
      process.env.AFFILIATE_IP_HASH_SALT,
    );

    const baseLog = {
      method: request.method,
      url: this.safeUrlForLog(request.originalUrl ?? request.url),
      trace_id: traceId,
      user_hash: userHash,
      ip: request.ip,
    };

    return next.handle().pipe(
      tap(() => {
        const duration_ms = Date.now() - startedAt;
        const status = response?.statusCode ?? 200;
        this.logger.info({ ...baseLog, status, duration_ms }, 'http_request');
        this.metrics.observeHttp(
          request.method,
          this.routeOf(request),
          status,
          duration_ms / 1000,
        );
      }),
      catchError((err: unknown) => {
        const duration_ms = Date.now() - startedAt;
        const status =
          (err as { status?: number; getStatus?: () => number })?.status ??
          (err as { getStatus?: () => number })?.getStatus?.() ??
          500;
        this.logger.error(
          {
            ...baseLog,
            status,
            duration_ms,
            err_message: (err as Error)?.message,
          },
          'http_request_error',
        );
        this.metrics.observeHttp(
          request.method,
          this.routeOf(request),
          status,
          duration_ms / 1000,
        );
        return throwError(() => err);
      }),
    );
  }
}
