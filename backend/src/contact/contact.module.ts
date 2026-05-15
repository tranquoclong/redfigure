import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { TurnstileModule } from '../turnstile/turnstile.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TurnstileModule, SettingsModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
