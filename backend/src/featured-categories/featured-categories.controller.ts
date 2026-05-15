import { Controller, Get } from '@nestjs/common';
import { FeaturedCategoriesService } from './featured-categories.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/site/featured-categories')
export class FeaturedCategoriesController {
  constructor(private readonly service: FeaturedCategoriesService) {}

  @Public()
  @Get()
  async findActive() {
    return { data: await this.service.findActive() };
  }
}
