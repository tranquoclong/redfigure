import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Roles('ADMIN')
  @Get('low-stock')
  async getLowStockProducts(
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
  ) {
    return {
      data: await this.stockService.findLowStockProducts(
        parseInt(page, 10),
        parseInt(perPage, 10),
      ),
    };
  }

  @Roles('ADMIN')
  @Get(':productId/log')
  async getStockLog(
    @Param('productId') productId: string,
    @Query('variationId') variationId?: string,
  ) {
    return {
      data: await this.stockService.getAuditLog(productId, variationId),
    };
  }

  @Roles('ADMIN')
  @Post(':productId/adjust')
  async adjustStock(
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: AdjustStockDto,
  ) {
    await this.stockService.adjustStock({
      productId,
      variationId: dto.variationId,
      delta: dto.delta,
      adminUserId: user.id,
    });

    return { data: { success: true } };
  }
}
