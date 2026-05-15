import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateAttributeDto,
  UpdateAttributeDto,
  CreateAttributeValueDto,
} from './dto/attribute.dto';

@Controller('api/v1/attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Public()
  @Get()
  async findAll() {
    const data = await this.attributesService.findAll();
    return { data };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateAttributeDto) {
    const data = await this.attributesService.create(dto);
    return { data };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAttributeDto) {
    const data = await this.attributesService.update(id, dto);
    return { data };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.attributesService.delete(id);
    return { data: { message: 'Attribute deleted' } };
  }

  @Roles('ADMIN')
  @Post(':id/values')
  async createValue(
    @Param('id') id: string,
    @Body() dto: CreateAttributeValueDto,
  ) {
    const data = await this.attributesService.createValue(id, dto);
    return { data };
  }

  @Roles('ADMIN')
  @Delete('values/:valueId')
  async deleteValue(@Param('valueId') valueId: string) {
    await this.attributesService.deleteValue(valueId);
    return { data: { message: 'Value deleted' } };
  }
}
