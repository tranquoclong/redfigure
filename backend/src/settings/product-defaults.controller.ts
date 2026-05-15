import { Controller, Get, Put, Body } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateProductDefaultsDto } from './dto/product-defaults.dto';

const DEFAULTS_KEYS = [
  'product_default_weight',
  'product_default_width',
  'product_default_height',
  'product_default_length',
  'product_default_condition',
  'product_default_color_id',
  'product_default_material_id',
] as const;

const KEY_TO_FIELD: Record<string, string> = {
  product_default_weight: 'weight',
  product_default_width: 'width',
  product_default_height: 'height',
  product_default_length: 'length',
  product_default_condition: 'condition',
  product_default_color_id: 'colorId',
  product_default_material_id: 'materialId',
};

const FIELD_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_FIELD).map(([k, v]) => [v, k]),
);

@Controller('api/v1/settings')
export class ProductDefaultsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Roles('ADMIN')
  @Get('product-defaults')
  async getDefaults() {
    const raw = await this.settingsService.getMany([...DEFAULTS_KEYS]);
    const data: Record<string, string> = {};
    for (const key of DEFAULTS_KEYS) {
      data[KEY_TO_FIELD[key]] = raw[key] ?? '';
    }
    return { data };
  }

  @Roles('ADMIN')
  @Put('product-defaults')
  async setDefaults(@Body() dto: UpdateProductDefaultsDto) {
    const entries = Object.entries(dto).filter(
      ([field]) => FIELD_TO_KEY[field],
    );
    await Promise.all(
      entries.map(([field, value]) =>
        this.settingsService.set(FIELD_TO_KEY[field], value ?? ''),
      ),
    );
    return { data: { message: 'Product defaults saved' } };
  }
}
