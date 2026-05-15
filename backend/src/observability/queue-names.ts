
export const BULLMQ_QUEUE_NAMES = [
  'email',
  'order-expiration',
  'order-trash-cleanup',
  'review-invites',
  'affiliate-ledger',
  'affiliate-visit-prune',
  'custom-quote-expiration',
  'viewed-anon-cleanup',
] as const;

export type BullMqQueueName = (typeof BULLMQ_QUEUE_NAMES)[number];
