import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ColorsService } from './colors.service';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  @Public()
  @Get()
  async findAll() {
    return { data: await this.colorsService.findAll() };
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return { data: await this.colorsService.findById(id) };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateColorDto) {
    return { data: await this.colorsService.create(dto) };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateColorDto) {
    return { data: await this.colorsService.update(id, dto) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.colorsService.remove(id);
    return { data: { message: 'Color deactivated successfully' } };
  }
}
