import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OWNERSHIP_KEY } from '../decorators/ownership.decorator';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ownershipParam = this.reflector.getAllAndOverride<string | undefined>(
      OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!ownershipParam) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.role === 'ADMIN') {
      return true;
    }

    const resourceOwnerId = request.params[ownershipParam];

    if (resourceOwnerId && resourceOwnerId !== user?.id) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
