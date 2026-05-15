import { Module } from '@nestjs/common';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';
import { AdminBannersController } from './admin-banners.controller';

@Module({
  providers: [BannersService],
  controllers: [BannersController, AdminBannersController],
  exports: [BannersService],
})
export class BannersModule {}
