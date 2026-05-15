import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_KEY = 'ownership';

export const CheckOwnership = (paramKey: string) =>
  SetMetadata(OWNERSHIP_KEY, paramKey);
