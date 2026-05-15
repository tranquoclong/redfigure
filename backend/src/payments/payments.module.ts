import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CheckoutLogService } from './checkout-log.service';
import { MetaCapiService } from './meta-capi.service';
import { StockModule } from '../stock/stock.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { EmailModule } from '../email/email.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { WebhookSignatureModule } from '../common/guards/webhook-signature.module';
import { ProductsModule } from '../products/products.module';

@Module({
    imports: [
        StockModule,
        forwardRef(() => OrdersModule),
        SettingsModule,
        EmailModule,
        AffiliatesModule,
        WebhookSignatureModule,
        ProductsModule,
    ],
    controllers: [PaymentsController],
    providers: [
        PaymentsService,
        CheckoutLogService,
        MetaCapiService,
    ],
    exports: [PaymentsService, CheckoutLogService],
})
export class PaymentsModule { }