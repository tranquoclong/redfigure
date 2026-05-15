import { Module, forwardRef } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartAdminController } from './cart-admin.controller';
import { CartService } from './cart.service';
import { ScalesModule } from '../scales/scales.module';
import { CustomQuotesModule } from '../custom-quotes/custom-quotes.module';
import { FreeGiftsModule } from '../free-gifts/free-gifts.module';
import { ProductsModule } from '../products/products.module';

@Module({

  imports: [
    ScalesModule,
    CustomQuotesModule,
    FreeGiftsModule,
    forwardRef(() => ProductsModule),
  ],
  controllers: [CartController, CartAdminController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
