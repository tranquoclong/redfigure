import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ScalesModule } from '../scales/scales.module';
import { CouponsModule } from '../coupons/coupons.module';
// import { PaymentsModule } from '../payments/payments.module';
import { CategoriesModule } from '../categories/categories.module';
// import { ShippingModule } from '../shipping/shipping.module';
import { CustomQuotesModule } from '../custom-quotes/custom-quotes.module';

@Module({
  imports: [
    ScalesModule,
    CouponsModule,
    // PaymentsModule,
    CategoriesModule,
    // ShippingModule,
    CustomQuotesModule,
  ],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule { }
