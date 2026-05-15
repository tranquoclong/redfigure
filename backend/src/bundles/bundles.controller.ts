import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { BundlesService } from './bundles.service';
import { CreateBundleDto } from './dto/create-bundle.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/bundles')
export class BundlesController {
  constructor(private readonly bundlesService: BundlesService) {}

  @Public()
  @Get()
  async findAll() {
    return await this.bundlesService.findAll();
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return await this.bundlesService.findBySlug(slug);
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateBundleDto) {
    return await this.bundlesService.create(dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.bundlesService.remove(id);
    return { message: 'Bundle deactivated successfully' };
  }
}
