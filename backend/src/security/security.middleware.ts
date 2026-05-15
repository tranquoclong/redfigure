import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { SecurityService } from './security.service';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  constructor(private readonly securityService: SecurityService) { }

  async use(req: Request, _res: Response, next: NextFunction) {
    const ip =
      req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

    const ban = await this.securityService.isBanned(ip);
    if (ban) {
      const minutes = Math.ceil(ban.ttl / 60);
      throw new ForbiddenException(
        `Your IP has been temporarily blocked for excessive attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      );
    }

    next();
  }
}
