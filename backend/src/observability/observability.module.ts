import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { BULLMQ_QUEUE_NAMES } from './queue-names';
import { BullBoardAdminAuthMiddleware } from './bull-board-admin-auth.middleware';
import { DebugSentryController } from './debug-sentry.controller';

const BULL_BOARD_ROUTE = '/api/admin/queues';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
      }),
    }),
    BullBoardModule.forRoot({
      route: BULL_BOARD_ROUTE,
      adapter: ExpressAdapter,
    }),
    ...BULLMQ_QUEUE_NAMES.map((name) =>
      BullBoardModule.forFeature({
        name,
        adapter: BullMQAdapter,
      }),
    ),
  ],
  controllers: [DebugSentryController],
  providers: [
    BullBoardAdminAuthMiddleware,

    ...BULLMQ_QUEUE_NAMES.map((name) => ({
      provide: `BullQueue_${name}`,
      inject: ['REDIS_CLIENT'],
      useFactory: (redis: import('ioredis').Redis) =>
        new Queue(
          name,
          withBullMqPrefix({
            connection: redis.duplicate(),
          }),
        ),
    })),
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {

    consumer
      .apply(BullBoardAdminAuthMiddleware)
      .forRoutes(BULL_BOARD_ROUTE, `${BULL_BOARD_ROUTE}/*splat`);
  }
}
