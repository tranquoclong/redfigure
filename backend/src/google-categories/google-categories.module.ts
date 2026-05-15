import { Module } from '@nestjs/common';
import { GoogleCategoriesController } from './google-categories.controller';
import { GoogleCategoriesService } from './google-categories.service';

@Module({
  controllers: [GoogleCategoriesController],
  providers: [GoogleCategoriesService],
  exports: [GoogleCategoriesService],
})
export class GoogleCategoriesModule {}
