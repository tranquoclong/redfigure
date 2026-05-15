import { Controller, Get, Put, Param, Body, Res, Header } from '@nestjs/common';
import type { Response } from 'express';
import { SeoService } from './seo.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpsertSeoMetaDto } from './dto/upsert-meta.dto';

@Controller()
export class SitemapRootController {
  constructor(private readonly seoService: SeoService) { }

  @Public()
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  async sitemapRoot(@Res() res: Response) {
    const baseUrl = process.env.SITE_URL ?? 'https://redfigure.com';
    const xml = await this.seoService.generateSitemap(baseUrl);
    res.send(xml);
  }

  @Public()
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  robotsRoot(@Res() res: Response) {
    const baseUrl = process.env.SITE_URL ?? 'https://redfigure.com';
    res.send(
      `User-Agent: *\nAllow: /\nDisallow: /admin\nDisallow: /my-account\nDisallow: /checkout\nDisallow: /api\nDisallow: /cart\n\nSitemap: ${baseUrl}/sitemap.xml\n`,
    );
  }
}

@Controller('api/v1/seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) { }

  @Public()
  @Get('meta/:entityType/:entityId')
  async getMeta(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const meta = await this.seoService.getMeta(entityType, entityId);
    return { data: meta };
  }

  @Roles('ADMIN')
  @Put('meta')
  async upsertMeta(@Body() dto: UpsertSeoMetaDto) {
    return { data: await this.seoService.upsertMeta(dto) };
  }

  @Public()
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  async sitemap(@Res() res: Response) {
    const baseUrl = process.env.SITE_URL ?? 'https://miniatures3d.com';
    const xml = await this.seoService.generateSitemap(baseUrl);
    res.send(xml);
  }
}
