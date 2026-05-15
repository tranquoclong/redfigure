import { Controller, Get, Post, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchIndexer } from './search.indexer';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly searchIndexer: SearchIndexer,
  ) { }

  @Public()
  @Get()
  async search(
    @Query('q') q: string,
    @Query('category') categoryName?: string,
    @Query('brand') brandName?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
  ) {
    const result = await this.searchService.search({
      query: q ?? '',
      categoryName,
      brandName,
      priceMin: priceMin ? parseFloat(priceMin) : undefined,
      priceMax: priceMax ? parseFloat(priceMax) : undefined,
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
    });

    return {
      data: result.hits,
      meta: {
        total: result.total,
        page: parseInt(page, 10),
        perPage: parseInt(perPage, 10),

        lastPage: Math.ceil(result.total / parseInt(perPage, 10)) || 1,
      },
    };
  }

  @Public()
  @Get('autocomplete')
  async autocomplete(@Query('q') q: string) {
    const results = await this.searchService.autocomplete(q ?? '');
    return { data: results };
  }

  @Roles('ADMIN')
  @Get('health')
  async health() {
    try {
      const info = await this.searchService.ping();
      return { data: { status: 'ok', ...info } };
    } catch (err) {
      return { data: { status: 'error', message: (err as Error).message } };
    }
  }

  @Roles('ADMIN')
  @Post('reindex')
  async reindex() {
    await this.searchIndexer.reindexAll();
    return { data: { message: 'Reindex completed' } };
  }
}
