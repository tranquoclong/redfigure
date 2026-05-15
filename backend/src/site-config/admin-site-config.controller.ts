import {
  Body,
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SiteConfigService } from './site-config.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateTopBarDto } from './dto/topbar.dto';
import { UpdateMarqueeDto } from './dto/marquee.dto';
import { UpdateGeneralDto } from './dto/general.dto';
import { UpdateMegaMenuDto } from './dto/megamenu.dto';
import { UpdateFooterDto } from './dto/footer.dto';

import { SetHomeBlocksDto } from './home-blocks.dto';
import { ToggleCacheDto } from './dto/cache-toggle.dto';

@Controller('api/v1/admin/site')
export class AdminSiteConfigController {
  private readonly logger = new Logger(AdminSiteConfigController.name);

  constructor(private readonly siteConfig: SiteConfigService) { }

  @Roles('ADMIN')
  @Put('topbar')
  async updateTopBar(@Body() dto: UpdateTopBarDto) {
    return { data: await this.siteConfig.setTopBar(dto) };
  }

  @Roles('ADMIN')
  @Put('marquee')
  async updateMarquee(@Body() dto: UpdateMarqueeDto) {
    return { data: await this.siteConfig.setMarquee(dto) };
  }

  @Roles('ADMIN')
  @Put('general')
  async updateGeneral(@Body() dto: UpdateGeneralDto) {
    return { data: await this.siteConfig.setGeneral(dto) };
  }

  @Roles('ADMIN')
  @Put('megamenu')
  async updateMegaMenu(@Body() dto: UpdateMegaMenuDto) {
    return { data: await this.siteConfig.setMegaMenu(dto) };
  }

  @Roles('ADMIN')
  @Put('footer')
  async updateFooter(@Body() dto: UpdateFooterDto) {
    return { data: await this.siteConfig.setFooter(dto) };
  }

  @Roles('ADMIN')
  @Get('home-blocks')
  async getHomeBlocks() {
    return { data: await this.siteConfig.getHomeBlocks() };
  }

  @Roles('ADMIN')
  @Put('home-blocks')
  async updateHomeBlocks(@Body() dto: SetHomeBlocksDto) {
    return { data: await this.siteConfig.setHomeBlocks(dto.blocks) };
  }

  @Roles('ADMIN')
  @Get('cache/status')
  async getCacheStatus() {
    const disabled = await this.siteConfig.isCacheDisabled();
    return { data: { disabled } };
  }

  @Roles('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('cache/toggle')
  @HttpCode(200)
  async toggleCache(
    @CurrentUser() user: { id: string },
    @Body() dto: ToggleCacheDto,
  ) {
    this.logger.log({
      msg: 'cache toggle',
      action: 'AUDIT_CACHE_TOGGLE',
      userId: user.id,
      disabled: dto.disabled,
    });
    const result = await this.siteConfig.setCacheDisabled(dto.disabled);
    return { data: result };
  }

  @Roles('ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cache/flush')
  @HttpCode(200)
  async flushCache(@CurrentUser() user: { id: string }) {
    this.logger.log({
      msg: 'cache flush initiated',
      action: 'AUDIT_CACHE_FLUSH_INTENT',
      userId: user.id,
    });
    try {
      const result = await this.siteConfig.flushAllCaches();
      this.logger.log({
        msg: 'cache flush completed',
        action: 'AUDIT_CACHE_FLUSH_SUCCESS',
        userId: user.id,
        scannedCount: result.scannedCount,
        flushedCount: result.flushed.length,
        failedCount: result.failed.length,
      });

      return { data: result };
    } catch (err) {
      this.logger.error({
        msg: 'cache flush failed',
        action: 'AUDIT_CACHE_FLUSH_FAILURE',
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new InternalServerErrorException('cache flush failed');
    }
  }
}
