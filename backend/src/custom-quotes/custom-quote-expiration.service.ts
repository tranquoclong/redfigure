import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { captureFailOpen } from '../observability/fail-open-capture';
import { CustomQuotesService } from './custom-quotes.service';

@Injectable()
export class CustomQuoteExpirationService {
  private readonly logger = new Logger(CustomQuoteExpirationService.name);

  constructor(private readonly quotesService: CustomQuotesService) {}

  @Cron('0 2 * * *')
  async processCleanup(): Promise<void> {
    try {
      const result = await this.quotesService.expireOutdated();
      this.logger.log(
        `Custom quote expiration done: ${result.count} quote(s) marked EXPIRED`,
      );
    } catch (err) {
      this.logger.error(
        `Custom quote expiration cron failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      captureFailOpen(err, 'custom_quote_expiration_cron');
    }
  }
}
