import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { PagesService } from './pages.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdatePageDto } from './dto/page.dto';

@Controller('api/v1/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Roles('ADMIN')
  @Get()
  async findAll() {
    const pages = await this.pagesService.findAll();
    return { data: pages };
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const page = await this.pagesService.findBySlug(slug);
    return { data: page };
  }

  @Roles('ADMIN')
  @Put(':slug')
  async update(@Param('slug') slug: string, @Body() dto: UpdatePageDto) {
    const page = await this.pagesService.update(slug, dto);
    return { data: page };
  }
}
