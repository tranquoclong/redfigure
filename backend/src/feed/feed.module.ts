import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { GoogleFeedService } from './google-feed.service';
import { MetaFeedService } from './meta-feed.service';
import { FEED_CACHE, type FeedCache } from './feed-cache';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisService } from '../redis/redis.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [PrismaModule, ProductsModule],
  controllers: [FeedController],
  providers: [
    GoogleFeedService,
    MetaFeedService,
    {
      provide: FEED_CACHE,
      inject: [RedisService],
      useFactory: (redis: RedisService): FeedCache => ({
        get: (key) => redis.get(key),
        set: (key, value, ttlSeconds) => redis.set(key, value, ttlSeconds),
      }),
    },
  ],
})
export class FeedModule {}
