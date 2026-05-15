import { SetMetadata } from '@nestjs/common';

export const WEBHOOK_SIGNATURE_KEY = 'webhookSignatureProvider';

export type WebhookProvider = 'sepay';

export const WebhookSignature = (provider: WebhookProvider) =>
  SetMetadata(WEBHOOK_SIGNATURE_KEY, provider);
