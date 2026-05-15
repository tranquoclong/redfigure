import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Public()
  @Get()
  async findAll() {
    return { data: await this.materialsService.findAll() };
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return { data: await this.materialsService.findById(id) };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateMaterialDto) {
    return { data: await this.materialsService.create(dto) };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return { data: await this.materialsService.update(id, dto) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.materialsService.remove(id);
    return { data: { message: 'Material deactivated successfully' } };
  }
}
