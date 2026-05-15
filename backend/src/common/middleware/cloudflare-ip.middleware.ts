import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class CloudflareIpMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CloudflareIpMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.length > 0 && cfIp.length < 64) {

      try {
        Object.defineProperty(req, 'ip', {
          value: cfIp.trim(),
          configurable: true,
          writable: false,
        });
      } catch {

        this.logger.warn(
          'Failed to override req.ip (already defined as own property)',
        );
      }
    }
    next();
  }
}
