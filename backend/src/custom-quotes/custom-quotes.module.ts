import { Module } from '@nestjs/common';
import { CustomQuotesController } from './custom-quotes.controller';
import { AdminCustomQuotesController } from './admin-custom-quotes.controller';
import { CustomQuotesService } from './custom-quotes.service';
import { CustomQuoteExpirationService } from './custom-quote-expiration.service';
import { TurnstileModule } from '../turnstile/turnstile.module';
import { SettingsModule } from '../settings/settings.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [TurnstileModule, SettingsModule, MediaModule],
  controllers: [CustomQuotesController, AdminCustomQuotesController],
  providers: [CustomQuotesService, CustomQuoteExpirationService],
  exports: [CustomQuotesService],
})
export class CustomQuotesModule {}
