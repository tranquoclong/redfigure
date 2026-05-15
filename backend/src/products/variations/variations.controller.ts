import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { VariationsService } from './variations.service';
import { CreateVariationDto } from './dto/create-variation.dto';
import { UpdateVariationDto } from './dto/update-variation.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('api/v1/products/:productId/variations')
export class VariationsController {
  constructor(private readonly variationsService: VariationsService) {}

  @Public()
  @Get()
  async findByProduct(@Param('productId') productId: string) {
    return await this.variationsService.findByProduct(productId);
  }

  @Roles('ADMIN')
  @Post()
  async create(
    @Param('productId') productId: string,
    @Body() dto: CreateVariationDto,
  ) {
    return await this.variationsService.create(productId, dto);
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateVariationDto) {
    return await this.variationsService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.variationsService.remove(id);
    return { message: 'Variation deleted' };
  }
}
