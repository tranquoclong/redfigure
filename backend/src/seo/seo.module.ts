import { Module } from '@nestjs/common';
import { SeoController, SitemapRootController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  controllers: [SeoController, SitemapRootController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
