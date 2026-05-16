import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { CouponsModule } from '../coupons/coupons.module';
import { UsersModule } from '../users/users.module';
import { CartAbandonmentService } from './cart-abandonment.service';
import { CartAbandonmentCronService } from './cart-abandonment.cron.service';

@Module({
  imports: [SettingsModule, CouponsModule, UsersModule],
  providers: [CartAbandonmentService, CartAbandonmentCronService],
  exports: [CartAbandonmentService],
})
export class CartAbandonmentModule {}
