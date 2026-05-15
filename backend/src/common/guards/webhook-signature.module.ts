import { Module } from '@nestjs/common';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import { SettingsModule } from '../../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [WebhookSignatureGuard],
  exports: [WebhookSignatureGuard, SettingsModule],
})
export class WebhookSignatureModule { }
