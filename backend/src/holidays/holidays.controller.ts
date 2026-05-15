import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) { }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateHolidayDto) {
    return { data: await this.holidaysService.create(dto) };
  }

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return { data: await this.holidaysService.findAll() };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.holidaysService.remove(id);
    return { data: { message: 'Holiday deleted' } };
  }
}
