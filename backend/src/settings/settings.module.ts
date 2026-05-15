import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { MediaCaptionPresetService } from './media-caption-preset.service';
import { AiSettingsController } from './ai-settings.controller';
import { ProductDefaultsController } from './product-defaults.controller';

@Module({
  controllers: [AiSettingsController, ProductDefaultsController],
  providers: [SettingsService, MediaCaptionPresetService],
  exports: [SettingsService, MediaCaptionPresetService],
})
export class SettingsModule {}
