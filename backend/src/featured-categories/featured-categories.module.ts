import { Module } from '@nestjs/common';
import { FeaturedCategoriesService } from './featured-categories.service';
import { FeaturedCategoriesController } from './featured-categories.controller';
import { AdminFeaturedCategoriesController } from './admin-featured-categories.controller';

@Module({
  providers: [FeaturedCategoriesService],
  controllers: [
    FeaturedCategoriesController,
    AdminFeaturedCategoriesController,
  ],
  exports: [FeaturedCategoriesService],
})
export class FeaturedCategoriesModule {}
