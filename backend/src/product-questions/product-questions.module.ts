import { Module } from '@nestjs/common';
import { PublicProductQuestionsController } from './public-product-questions.controller';
import { AdminProductQuestionsController } from './admin-product-questions.controller';
import { ProductQuestionsService } from './product-questions.service';
import { TurnstileModule } from '../turnstile/turnstile.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TurnstileModule, SettingsModule],
  controllers: [
    PublicProductQuestionsController,
    AdminProductQuestionsController,
  ],
  providers: [ProductQuestionsService],
})
export class ProductQuestionsModule {}
