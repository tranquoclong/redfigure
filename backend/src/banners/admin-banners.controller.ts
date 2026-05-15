import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { BannersService } from './banners.service';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateBannerDto,
  UpdateBannerDto,
  ReorderBannersDto,
} from './dto/banner.dto';

@Controller('api/v1/admin/banners')
export class AdminBannersController {
  constructor(private readonly banners: BannersService) { }

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return { data: await this.banners.findAll() };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateBannerDto) {
    return { data: await this.banners.create(dto) };
  }

  @Roles('ADMIN')
  @Put('reorder')
  async reorder(@Body() dto: ReorderBannersDto) {
    await this.banners.reorder(dto.items);
    return { data: { message: 'Order updated' } };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return { data: await this.banners.update(id, dto) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.banners.remove(id);
    return { data: { message: 'Banner deleted' } };
  }
}
