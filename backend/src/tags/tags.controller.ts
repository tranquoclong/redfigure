import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';

@Controller('api/v1/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Public()
  @Get()
  async findAll() {
    return { data: await this.tagsService.findAll() };
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return { data: await this.tagsService.findBySlug(slug) };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateTagDto) {
    return { data: await this.tagsService.create(dto) };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return { data: await this.tagsService.update(id, dto) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.tagsService.remove(id);
    return { data: { message: 'Tag deactivated successfully' } };
  }
}
