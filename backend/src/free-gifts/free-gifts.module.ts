import { Module } from '@nestjs/common';
import { FreeGiftsController } from './free-gifts.controller';
import { FreeGiftsService } from './free-gifts.service';

@Module({
  controllers: [FreeGiftsController],
  providers: [FreeGiftsService],
  exports: [FreeGiftsService],
})
export class FreeGiftsModule {}
