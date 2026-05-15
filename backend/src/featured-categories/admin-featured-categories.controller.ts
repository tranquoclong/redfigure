import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { FeaturedCategoriesService } from './featured-categories.service';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateFeaturedCategoryDto,
  UpdateFeaturedCategoryDto,
  ReorderFeaturedCategoriesDto,
} from './dto/featured-category.dto';

@Controller('api/v1/admin/featured-categories')
export class AdminFeaturedCategoriesController {
  constructor(private readonly service: FeaturedCategoriesService) { }

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return { data: await this.service.findAll() };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateFeaturedCategoryDto) {
    return { data: await this.service.create(dto) };
  }

  @Roles('ADMIN')
  @Put('reorder')
  async reorder(@Body() dto: ReorderFeaturedCategoriesDto) {
    await this.service.reorder(dto.items);
    return { data: { message: 'Order updated successfully' } };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFeaturedCategoryDto,
  ) {
    return { data: await this.service.update(id, dto) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { data: { message: 'Removed' } };
  }
}
