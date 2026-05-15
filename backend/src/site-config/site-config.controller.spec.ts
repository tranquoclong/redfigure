import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SiteConfigController } from './site-config.controller';
import { AdminSiteConfigController } from './admin-site-config.controller';
import { SiteConfigService } from './site-config.service';
import { HomeBlocksAggregator } from './home-blocks.aggregator';
import { RedisService } from '../redis/redis.service';
import { ToggleCacheDto } from './dto/cache-toggle.dto';

describe('SiteConfig controllers', () => {
  let publicCtrl: SiteConfigController;
  let adminCtrl: AdminSiteConfigController;
  let service: jest.Mocked<SiteConfigService>;
  let aggregator: jest.Mocked<HomeBlocksAggregator>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SiteConfigController, AdminSiteConfigController],
      providers: [
        {
          provide: SiteConfigService,
          useValue: {
            getTopBar: jest.fn(),
            setTopBar: jest.fn(),
            getMarquee: jest.fn(),
            setMarquee: jest.fn(),
            getGeneral: jest.fn(),
            setGeneral: jest.fn(),
            getLoginFeaturedProduct: jest.fn(),
            getHomeBlocks: jest.fn(),
            setHomeBlocks: jest.fn(),
            isCacheDisabled: jest.fn().mockResolvedValue(false),
            setCacheDisabled: jest.fn(),
            flushAllCaches: jest.fn(),
          },
        },
        {
          provide: HomeBlocksAggregator,
          useValue: { aggregate: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: RedisService,
          useValue: {
            getJson: jest.fn().mockResolvedValue(null),
            setJson: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    publicCtrl = module.get(SiteConfigController);
    adminCtrl = module.get(AdminSiteConfigController);
    service = module.get(SiteConfigService);
    aggregator = module.get(HomeBlocksAggregator);
  });

  describe('public — GET /api/v1/site/*', () => {
    it('GET topbar wraps result in { data }', async () => {
      const stub = {
        messages: [{ text: 'x', align: 'left' as const }],
      };
      service.getTopBar.mockResolvedValue(stub);
      const res = await publicCtrl.getTopBar();
      expect(res).toEqual({ data: stub });
    });

    it('GET marquee wraps result in { data }', async () => {
      const stub = { items: ['A', 'B'] };
      service.getMarquee.mockResolvedValue(stub);
      const res = await publicCtrl.getMarquee();
      expect(res).toEqual({ data: stub });
    });

    it('GET general wraps result in { data }', async () => {
      const stub = {
        siteName: 'X',
        siteTagline: 'Y',
        ogImageUrl: null,
        loginFeaturedProductId: null,
      };
      service.getGeneral.mockResolvedValue(stub);
      const res = await publicCtrl.getGeneral();
      expect(res).toEqual({ data: stub });
    });

    it('GET login-featured wraps result in { data } (product or null)', async () => {
      const stub = {
        id: 'p1',
        name: 'Aurora',
        slug: 'aurora',
        imageUrl: 'https://cdn.x/a.webp',
        alt: null,
      };
      service.getLoginFeaturedProduct.mockResolvedValue(stub);
      const res = await publicCtrl.getLoginFeaturedProduct();
      expect(res).toEqual({ data: stub });
    });

    it('GET login-featured returns { data: null } when nothing featured', async () => {
      service.getLoginFeaturedProduct.mockResolvedValue(null);
      const res = await publicCtrl.getLoginFeaturedProduct();
      expect(res).toEqual({ data: null });
    });
  });

  describe('admin — PUT /api/v1/admin/site/*', () => {
    it('PUT topbar delegates to service.setTopBar and wraps result', async () => {
      const dto = {
        messages: [{ text: 'new', align: 'left' as const }],
      };
      service.setTopBar.mockResolvedValue(dto);
      const res = await adminCtrl.updateTopBar(dto);
      expect(service.setTopBar).toHaveBeenCalledWith(dto);
      expect(res).toEqual({ data: dto });
    });

    it('PUT marquee delegates and wraps', async () => {
      const dto = { items: ['A', 'B'] };
      service.setMarquee.mockResolvedValue(dto);
      const res = await adminCtrl.updateMarquee(dto);
      expect(service.setMarquee).toHaveBeenCalledWith(dto);
      expect(res).toEqual({ data: dto });
    });

    it('PUT general delegates and wraps', async () => {
      const dto = {
        siteName: 'Elite',
        siteTagline: 'Tagline',
        ogImageUrl: null,
      };
      service.setGeneral.mockResolvedValue(dto);
      const res = await adminCtrl.updateGeneral(dto);
      expect(service.setGeneral).toHaveBeenCalledWith(dto);
      expect(res).toEqual({ data: dto });
    });
  });

  describe('home-blocks', () => {
    it('public GET returns blocks + aggregated payload', async () => {
      const blocks = [
        { id: 'h1', type: 'newsletter', order: 0, isActive: true, data: {} },
      ];
      service.getHomeBlocks.mockResolvedValue({ blocks } as never);
      aggregator.aggregate.mockResolvedValue({
        banners: [],
        featuredCategories: [],
        latestProducts: [],
        featuredProducts: [],
        faqItemsBySlug: {},
        highlightedReviews: [],
      } as never);

      const res = await publicCtrl.getHomeBlocks();
      expect(service.getHomeBlocks).toHaveBeenCalled();
      expect(aggregator.aggregate).toHaveBeenCalledWith(blocks);
      expect(res.data.blocks).toEqual(blocks);
      expect(res.data.aggregated).toBeDefined();
    });

    it('admin GET returns blocks WITHOUT aggregated', async () => {
      const blocks = [
        { id: 'h1', type: 'newsletter', order: 0, isActive: true, data: {} },
      ];
      service.getHomeBlocks.mockResolvedValue({ blocks } as never);
      const res = await adminCtrl.getHomeBlocks();
      expect(res.data.blocks).toEqual(blocks);

      expect(aggregator.aggregate).not.toHaveBeenCalled();
    });

    it('admin PUT calls setHomeBlocks with array', async () => {
      const blocks = [
        { id: 'h1', type: 'newsletter', order: 0, isActive: true, data: {} },
      ];
      service.setHomeBlocks.mockResolvedValue({ blocks } as never);
      const res = await adminCtrl.updateHomeBlocks({ blocks } as never);
      expect(service.setHomeBlocks).toHaveBeenCalledWith(blocks);
      expect(res).toEqual({ data: { blocks } });
    });
  });

  describe('home-blocks respects toggle cache', () => {
    let redis: jest.Mocked<RedisService>;

    beforeEach(() => {
      redis = (publicCtrl as unknown as { redis: jest.Mocked<RedisService> })
        .redis;
    });

    it('when cache enabled and cache hit, returns cached WITHOUT calling service or aggregator', async () => {
      service.isCacheDisabled.mockResolvedValue(false);
      const cached = {
        blocks: [
          { id: 'c1', type: 'newsletter', order: 0, isActive: true, data: {} },
        ],
        aggregated: {
          banners: [],
          featuredCategories: [],
          latestProducts: [],
          featuredProducts: [],
          faqItemsBySlug: {},
          highlightedReviews: [],
        },
      };
      redis.getJson.mockResolvedValue(cached);

      const res = await publicCtrl.getHomeBlocks();

      expect(redis.getJson).toHaveBeenCalledWith(
        'cache:site:home-blocks:hydrated',
      );
      expect(service.getHomeBlocks).not.toHaveBeenCalled();
      expect(aggregator.aggregate).not.toHaveBeenCalled();
      expect(res.data).toEqual(cached);
    });

    it('when cache disabled, does NOT read or write Redis (skips cache completely)', async () => {
      service.isCacheDisabled.mockResolvedValue(true);
      const blocks = [
        { id: 'h1', type: 'newsletter', order: 0, isActive: true, data: {} },
      ];
      service.getHomeBlocks.mockResolvedValue({ blocks } as never);
      aggregator.aggregate.mockResolvedValue({
        banners: [],
        featuredCategories: [],
        latestProducts: [],
        featuredProducts: [],
        faqItemsBySlug: {},
        highlightedReviews: [],
      } as never);

      const res = await publicCtrl.getHomeBlocks();

      expect(redis.getJson).not.toHaveBeenCalled();
      expect(redis.setJson).not.toHaveBeenCalled();

      expect(service.getHomeBlocks).toHaveBeenCalled();
      expect(aggregator.aggregate).toHaveBeenCalledWith(blocks);
      expect(res.data.blocks).toEqual(blocks);
    });
  });

  describe('admin cache endpoints', () => {
    it('GET /cache/status returns current disabled state', async () => {
      service.isCacheDisabled.mockResolvedValue(true);
      const res = await adminCtrl.getCacheStatus();
      expect(res).toEqual({ data: { disabled: true } });
    });

    it('POST /cache/toggle delegates to setCacheDisabled and returns new state', async () => {
      service.setCacheDisabled.mockResolvedValue({ disabled: true });
      const dto = new ToggleCacheDto();
      dto.disabled = true;
      const res = await adminCtrl.toggleCache({ id: 'admin-1' }, dto);
      expect(service.setCacheDisabled).toHaveBeenCalledWith(true);
      expect(res).toEqual({ data: { disabled: true } });
    });

    it('POST /cache/toggle accepts disabled=false (re-enables cache)', async () => {
      service.setCacheDisabled.mockResolvedValue({ disabled: false });
      const dto = new ToggleCacheDto();
      dto.disabled = false;
      const res = await adminCtrl.toggleCache({ id: 'admin-1' }, dto);
      expect(service.setCacheDisabled).toHaveBeenCalledWith(false);
      expect(res).toEqual({ data: { disabled: false } });
    });

    it('POST /cache/flush returns full result { flushed, failed, scannedCount }', async () => {
      const flushResult = {
        flushed: ['cache:site:topbar', 'cache:site:footer'],
        failed: [],
        scannedCount: 2,
      };
      service.flushAllCaches.mockResolvedValue(flushResult);
      const res = await adminCtrl.flushCache({ id: 'admin-1' });
      expect(res).toEqual({ data: flushResult });
    });

    it('POST /cache/flush propagates error when service throws', async () => {
      service.flushAllCaches.mockRejectedValue(new Error('redis dead'));

      await expect(adminCtrl.flushCache({ id: 'admin-1' })).rejects.toThrow(
        'cache flush failed',
      );
    });
  });

  describe('ToggleCacheDto validation', () => {
    it('accepts disabled: true', async () => {
      const dto = plainToInstance(ToggleCacheDto, { disabled: true });
      expect(await validate(dto)).toEqual([]);
    });

    it('accepts disabled: false', async () => {
      const dto = plainToInstance(ToggleCacheDto, { disabled: false });
      expect(await validate(dto)).toEqual([]);
    });

    it('rejects truthy string "yes"', async () => {
      const dto = plainToInstance(ToggleCacheDto, { disabled: 'yes' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('rejects number 1', async () => {
      const dto = plainToInstance(ToggleCacheDto, { disabled: 1 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects absence of the field', async () => {
      const dto = plainToInstance(ToggleCacheDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
