import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UnsubscribeService } from './unsubscribe.service';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [UsersController],
  providers: [UsersService, UnsubscribeService],
  exports: [UsersService, UnsubscribeService],
})
export class UsersModule {}
