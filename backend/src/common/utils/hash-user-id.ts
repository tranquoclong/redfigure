import { createHmac } from 'crypto';

export function hashUserId(
  userId: string | undefined | null,
  salt: string | undefined,
): string | undefined {
  if (!userId || !salt) return undefined;
  return createHmac('sha256', salt).update(userId).digest('hex').slice(0, 16);
}
