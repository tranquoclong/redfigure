import { Controller, Delete, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { NewsletterService } from './newsletter.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/admin/newsletter')
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) { }

  @Roles('ADMIN')
  @Get('subscribers')
  async list(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
  ) {
    return await this.newsletter.list({
      page: page ? parseInt(page, 10) : 1,
      perPage: perPage ? parseInt(perPage, 10) : 20,
      search,
    });
  }

  @Roles('ADMIN')
  @Get('stats')
  async stats() {
    return { data: await this.newsletter.stats() };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async unsubscribe(@Param('id') id: string) {
    await this.newsletter.unsubscribe(id);
    return { data: { message: 'Removed from list' } };
  }

  @Roles('ADMIN')
  @Get('export.csv')
  async exportCsv(@Res() res: Response): Promise<void> {
    const csv = await this.newsletter.exportCsv();
    const filename = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    res.type('text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
