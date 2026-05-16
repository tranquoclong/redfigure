import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { captureFailOpen } from '../observability/fail-open-capture';
import { CartAbandonmentService } from './cart-abandonment.service';

@Injectable()
export class CartAbandonmentCronService {
  private readonly logger = new Logger(CartAbandonmentCronService.name);

  constructor(private readonly service: CartAbandonmentService) {}

  @Cron('0 1 * * *')
  async processCleanup(): Promise<{
    firstSent: number;
    secondSent: number;
    skipped: number;
  }> {
    try {
      const result = await this.service.processAbandonedCarts();
      this.logger.log(
        `Cart abandonment done: firstSent=${result.firstSent}, secondSent=${result.secondSent}, skipped=${result.skipped}`,
      );
      return result;
    } catch (err) {
      this.logger.error(
        `Cart abandonment cron failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      captureFailOpen(err, 'cart_abandonment_cron');
      return { firstSent: 0, secondSent: 0, skipped: 0 };
    }
  }
}

