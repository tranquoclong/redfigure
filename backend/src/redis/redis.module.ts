import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>(
          'REDIS_URL',
          'redis://localhost:6379',
        );
        const password = configService.get<string>('REDIS_PASSWORD');

        return new Redis(url, {
          password: password || undefined,
          maxRetriesPerRequest: 3,
          retryStrategy(times) {
            return Math.min(times * 200, 2000);
          },
        });
      },
    },
    RedisService,
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}
