import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AffiliateActiveGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const account = await this.prisma.affiliateAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You are not yet an affiliate',
        code: 'AFFILIATE_NOT_ENROLLED',
      });
    }

    if (account.status !== 'APPROVED') {
      throw new ForbiddenException({
        statusCode: 403,
        message: `Affiliate account in ${account.status} status`,
        code: 'AFFILIATE_NOT_ACTIVE',
        status: account.status,
      });
    }

    req.affiliate = account;
    return true;
  }
}
