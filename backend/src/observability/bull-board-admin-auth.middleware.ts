import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class BullBoardAdminAuthMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers?.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ error: { statusCode: 401, message: 'Unauthorized' } });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      res
        .status(401)
        .json({ error: { statusCode: 401, message: 'Unauthorized' } });
      return;
    }

    let payload: { sub?: string; role?: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      res
        .status(401)
        .json({ error: { statusCode: 401, message: 'Unauthorized' } });
      return;
    }

    if (payload?.type !== 'access') {
      res
        .status(401)
        .json({ error: { statusCode: 401, message: 'Unauthorized' } });
      return;
    }

    if (payload?.role !== 'ADMIN') {
      res
        .status(403)
        .json({ error: { statusCode: 403, message: 'Forbidden' } });
      return;
    }

    next();
  }
}
