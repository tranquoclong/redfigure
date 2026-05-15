import {
  Module,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { CustomQuotesController } from './custom-quotes.controller';
import { AdminCustomQuotesController } from './admin-custom-quotes.controller';
import { CustomQuotesService } from './custom-quotes.service';
import { CustomQuoteExpirationService } from './custom-quote-expiration.service';
import { TurnstileModule } from '../turnstile/turnstile.module';
import { SettingsModule } from '../settings/settings.module';
import { MediaModule } from '../media/media.module';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureBullError } from '../observability/bullmq-error-capture';

@Module({
  imports: [TurnstileModule, SettingsModule, MediaModule],
  controllers: [CustomQuotesController, AdminCustomQuotesController],
  providers: [CustomQuotesService, CustomQuoteExpirationService],
  exports: [CustomQuotesService],
})
export class CustomQuotesModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CustomQuotesModule.name);
  private expirationWorker: Worker | null = null;

  constructor(
    private readonly expirationService: CustomQuoteExpirationService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) { }

  onModuleInit() {
    this.expirationWorker = new Worker(
      'custom-quote-expiration',
      async () => {
        await this.expirationService.processCleanup();
      },
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        concurrency: 1,
      }),
    );

    this.expirationWorker.on('completed', () => {
      this.logger.log('Custom quote expiration job completed');
    });

    this.expirationWorker.on('failed', (job, error) => {
      this.logger.error(
        `Custom quote expiration job failed: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'job_failed', 'custom-quote-expiration', job);
    });

    this.expirationWorker.on('error', (error) => {
      this.logger.error(
        `Custom quote expiration worker error: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'worker_error', 'custom-quote-expiration');
    });

    this.logger.log('Custom quote expiration worker started');
  }

  async onModuleDestroy() {
    await this.expirationWorker?.close();
  }
}
