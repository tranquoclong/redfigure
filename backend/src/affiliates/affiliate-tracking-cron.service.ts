import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AffiliateTrackingService } from './affiliate-tracking.service';

@Injectable()
export class AffiliateTrackingCronService {
  private readonly logger = new Logger(AffiliateTrackingCronService.name);

  constructor(private readonly tracking: AffiliateTrackingService) {}

  @Cron('0 3 * * *')
  async processPrune(): Promise<void> {
    const count = await this.tracking.pruneOldVisits();
    this.logger.log(`Affiliate visit prune done: ${count} visit(s) deleted`);
  }
}
