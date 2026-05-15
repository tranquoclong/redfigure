import { Controller, Get } from '@nestjs/common';
import { BannersService } from './banners.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/site/banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Public()
  @Get()
  async findActive() {
    return { data: await this.banners.findActive() };
  }
}
