import { Controller, Get, Logger } from '@nestjs/common';
import { SiteConfigService } from './site-config.service';
import {
  HomeBlocksAggregator,
  AggregatedHomePayload,
} from './home-blocks.aggregator';
import { RedisService } from '../redis/redis.service';
import { Public } from '../common/decorators/public.decorator';
import { AnyHomeBlock, HOME_BLOCKS_CACHE_KEYS } from './home-blocks.types';

const HYDRATED_TTL_SECONDS = 3600;

@Controller('api/v1/site')
export class SiteConfigController {
  private readonly logger = new Logger(SiteConfigController.name);

  private hydratedPromise: Promise<{
    blocks: AnyHomeBlock[];
    aggregated: AggregatedHomePayload;
  }> | null = null;

  constructor(
    private readonly siteConfig: SiteConfigService,
    private readonly aggregator: HomeBlocksAggregator,
    private readonly redis: RedisService,
  ) { }

  @Public()
  @Get('topbar')
  async getTopBar() {
    return { data: await this.siteConfig.getTopBar() };
  }

  @Public()
  @Get('marquee')
  async getMarquee() {
    return { data: await this.siteConfig.getMarquee() };
  }

  @Public()
  @Get('general')
  async getGeneral() {
    return { data: await this.siteConfig.getGeneral() };
  }

  @Public()
  @Get('login-featured')
  async getLoginFeaturedProduct() {
    return { data: await this.siteConfig.getLoginFeaturedProduct() };
  }

  @Public()
  @Get('megamenu')
  async getMegaMenu() {
    return { data: await this.siteConfig.getMegaMenu() };
  }

  @Public()
  @Get('footer')
  async getFooter() {
    return { data: await this.siteConfig.getFooter() };
  }

  @Public()
  @Get('home-blocks')
  async getHomeBlocks(): Promise<{
    data: { blocks: AnyHomeBlock[]; aggregated: AggregatedHomePayload };
  }> {
    type Hydrated = {
      blocks: AnyHomeBlock[];
      aggregated: AggregatedHomePayload;
    };

    const cacheDisabled = await this.siteConfig.isCacheDisabled();

    if (!cacheDisabled) {
      try {
        const cached = await this.redis.getJson<Hydrated>(
          HOME_BLOCKS_CACHE_KEYS.hydrated,
        );
        if (cached) return { data: cached };
      } catch (err) {
        this.logger.warn(
          `Failed to read hydrated cache: ${(err as Error).message}`,
        );
      }
    }

    if (!this.hydratedPromise) {
      this.hydratedPromise = (async () => {
        try {
          const config = await this.siteConfig.getHomeBlocks();
          const aggregated = await this.aggregator.aggregate(config.blocks);
          const built: Hydrated = { blocks: config.blocks, aggregated };
          if (!cacheDisabled) {
            try {
              await this.redis.setJson(
                HOME_BLOCKS_CACHE_KEYS.hydrated,
                built,
                HYDRATED_TTL_SECONDS,
              );
            } catch (err) {
              this.logger.warn(
                `Failed to write hydrated cache: ${(err as Error).message}`,
              );
            }
          }
          return built;
        } finally {
          this.hydratedPromise = null;
        }
      })();
    }
    const payload = await this.hydratedPromise;
    return { data: payload };
  }
}
