
import type { AffiliateAccount } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {

      user?: {
        id: string;
        sub?: string;
        email?: string;
        role?: string;
      };

      affiliate?: AffiliateAccount;
    }
  }
}

export {};
