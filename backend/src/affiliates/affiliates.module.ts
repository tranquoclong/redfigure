import {
  Module,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { AffiliatesService } from './affiliates.service';
import { AffiliateCommissionRulesService } from './affiliate-commission-rules.service';
import { AffiliateResolverService } from './affiliate-resolver.service';
import { AffiliateCommissionService } from './affiliate-commission.service';
import { AffiliateLedgerService } from './affiliate-ledger.service';
import { AffiliateLedgerCronService } from './affiliate-ledger-cron.service';
import { AffiliateStatsService } from './affiliate-stats.service';
import { AffiliatePaymentService } from './affiliate-payment.service';
import { AffiliateFraudDetectorService } from './affiliate-fraud-detector.service';
import { AffiliateSettingsAuditService } from './affiliate-settings-audit.service';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { AffiliateTrackingCronService } from './affiliate-tracking-cron.service';
import { AffiliatesController } from './affiliates.controller';
import { AdminAffiliatesController } from './admin-affiliates.controller';
import { AdminCommissionRulesController } from './admin-commission-rules.controller';
import { AffiliateTrackingController } from './affiliate-tracking.controller';
import { AffiliateActiveGuard } from './guards/affiliate-active.guard';
import { SettingsModule } from '../settings/settings.module';
import { CategoriesModule } from '../categories/categories.module';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureBullError } from '../observability/bullmq-error-capture';

@Module({
  imports: [SettingsModule, CategoriesModule],
  controllers: [
    AffiliatesController,
    AdminAffiliatesController,
    AdminCommissionRulesController,
    AffiliateTrackingController,
  ],
  providers: [
    AffiliatesService,
    AffiliateCommissionRulesService,
    AffiliateResolverService,
    AffiliateCommissionService,
    AffiliateLedgerService,
    AffiliateLedgerCronService,
    AffiliateStatsService,
    AffiliatePaymentService,
    AffiliateFraudDetectorService,
    AffiliateSettingsAuditService,
    AffiliateTrackingService,
    AffiliateTrackingCronService,
    AffiliateActiveGuard,
  ],
  exports: [
    AffiliatesService,
    AffiliateCommissionRulesService,
    AffiliateResolverService,
    AffiliateCommissionService,
    AffiliateLedgerService,
    AffiliateStatsService,
    AffiliatePaymentService,
    AffiliateFraudDetectorService,
    AffiliateSettingsAuditService,
    AffiliateTrackingService,
    AffiliateActiveGuard,
  ],
})
export class AffiliatesModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AffiliatesModule.name);
  private pruneWorker: Worker | null = null;
  private ledgerWorker: Worker | null = null;

  constructor(
    private readonly cronService: AffiliateTrackingCronService,
    private readonly ledgerCronService: AffiliateLedgerCronService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) { }

  onModuleInit() {
    this.pruneWorker = new Worker(
      'affiliate-visit-prune',
      async () => {
        await this.cronService.processPrune();
      },
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        concurrency: 1,
      }),
    );

    this.pruneWorker.on('completed', () => {
      this.logger.log('Affiliate visit prune job completed');
    });

    this.pruneWorker.on('failed', (job, error) => {
      this.logger.error(
        `Affiliate visit prune job failed: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'job_failed', 'affiliate-visit-prune', job);
    });

    this.pruneWorker.on('error', (error) => {
      this.logger.error(
        `Affiliate visit prune worker error: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'worker_error', 'affiliate-visit-prune');
    });

    this.logger.log('Affiliate visit prune worker started');

    this.ledgerWorker = new Worker(
      'affiliate-ledger',
      async (job) => {
        if (job.name === 'approve-pending-commissions') {
          await this.ledgerCronService.processApprovals();
        } else if (job.name === 'invariant-check') {
          await this.ledgerCronService.processInvariantCheck();
        } else if (job.name === 'fraud-scan') {
          await this.ledgerCronService.processFraudScan();
        } else if (job.name === 'chain-check') {
          await this.ledgerCronService.processChainIntegrity();
        } else {
          this.logger.warn(`Unknown affiliate-ledger job name: ${job.name}`);
        }
      },
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        concurrency: 1,
      }),
    );

    this.ledgerWorker.on('completed', (job) => {
      this.logger.log(`Affiliate ledger job ${job.name} completed`);
    });

    this.ledgerWorker.on('failed', (job, error) => {
      this.logger.error(
        `Affiliate ledger job ${job?.name} failed: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'job_failed', 'affiliate-ledger', job);
    });

    this.ledgerWorker.on('error', (error) => {
      this.logger.error(
        `Affiliate ledger worker error: ${error.message}`,
        error.stack,
      );
      captureBullError(error, 'worker_error', 'affiliate-ledger');
    });

    this.logger.log('Affiliate ledger worker started');
  }

  async onModuleDestroy() {
    await this.pruneWorker?.close();
    await this.ledgerWorker?.close();
  }
}
