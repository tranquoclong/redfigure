import { Controller, Get, Param, Query } from '@nestjs/common';
import { GoogleCategoriesService } from './google-categories.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/google-categories')
export class GoogleCategoriesController {
  constructor(
    private readonly googleCategoriesService: GoogleCategoriesService,
  ) {}

  @Public()
  @Get('search')
  async search(@Query('q') q = '', @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return {
      data: await this.googleCategoriesService.search(q, parsedLimit),
    };
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return { data: await this.googleCategoriesService.findById(id) };
  }
}
