import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { AiProductService } from './ai-product.service';
import { SkuService } from './sku.service';
import { MerchantFieldsService } from './merchant-fields.service';
import { VariationsController } from './variations/variations.controller';
import { VariationsService } from './variations/variations.service';
import { CategoriesModule } from '../categories/categories.module';
import { AttributesModule } from '../attributes/attributes.module';
import { SettingsModule } from '../settings/settings.module';
import { DropboxModule } from '../dropbox/dropbox.module';

@Module({
  imports: [CategoriesModule, AttributesModule, SettingsModule, DropboxModule],
  controllers: [ProductsController, VariationsController],
  providers: [
    ProductsService,
    VariationsService,
    MerchantFieldsService,
    AiProductService,
    SkuService,
  ],
  exports: [
    ProductsService,
    VariationsService,
    MerchantFieldsService,
    SkuService,
  ],
})
export class ProductsModule {}
