import { Module } from '@nestjs/common';
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
export class AffiliatesModule {}

