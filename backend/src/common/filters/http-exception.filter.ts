import {
  ExceptionFilter,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;

        if (Array.isArray(resp.message)) {
          message = 'Validation failed';
          details = resp.message;
        } else {
          message = resp.message ?? exception.message;
        }
      }
    } else {
      this.logger.error(
        `Unhandled exception: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (statusCode >= 500) {
      Sentry.captureException(exception);
    }

    const errorResponse: Record<string, any> = { statusCode, message };
    if (details) errorResponse.details = details;

    response.status(statusCode).json({ error: errorResponse });
  }
}
