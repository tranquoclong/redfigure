import { Module } from '@nestjs/common';
import { SiteConfigService } from './site-config.service';
import { SiteConfigController } from './site-config.controller';
import { AdminSiteConfigController } from './admin-site-config.controller';
import { HomeBlocksAggregator } from './home-blocks.aggregator';
import { SettingsModule } from '../settings/settings.module';
import { RedisModule } from '../redis/redis.module';
import { BannersModule } from '../banners/banners.module';
import { FeaturedCategoriesModule } from '../featured-categories/featured-categories.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [
    SettingsModule,
    RedisModule,
    BannersModule,
    FeaturedCategoriesModule,
    ReviewsModule,
  ],
  providers: [SiteConfigService, HomeBlocksAggregator],
  controllers: [SiteConfigController, AdminSiteConfigController],
  exports: [SiteConfigService, HomeBlocksAggregator],
})
export class SiteConfigModule {}
