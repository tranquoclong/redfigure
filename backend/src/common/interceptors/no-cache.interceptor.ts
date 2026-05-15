import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Response } from 'express';

const PRIVATE_ROUTE_PATTERNS = [
  '/api/v1/cart',
  '/api/v1/orders',
  '/api/v1/wishlist',
  '/api/v1/recently-viewed',
  '/api/v1/users/me',
  '/api/v1/addresses',
  '/api/v1/checkout',
  '/api/v1/site',
  '/api/v1/admin',
];

@Injectable()
export class NoCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response: Response = context.switchToHttp().getResponse();

    const path: string = request.path || '';

    const isPrivate = PRIVATE_ROUTE_PATTERNS.some((p) => path.startsWith(p));

    if (isPrivate) {

      response.setHeader(
        'Cache-Control',
        'private, no-store, no-cache, must-revalidate',
      );
      response.setHeader('CDN-Cache-Control', 'no-store');
      response.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
    }

    return next.handle();
  }
}
