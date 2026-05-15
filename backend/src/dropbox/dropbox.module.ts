import { Module } from '@nestjs/common';
import { DropboxController } from './dropbox.controller';
import { DropboxService } from './dropbox.service';
import { SettingsModule } from '../settings/settings.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [SettingsModule, MediaModule],
  controllers: [DropboxController],
  providers: [DropboxService],
  exports: [DropboxService],
})
export class DropboxModule {}
