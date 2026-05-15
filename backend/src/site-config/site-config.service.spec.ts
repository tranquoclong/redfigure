import { Test, TestingModule } from '@nestjs/testing';
import { SiteConfigService, DEFAULTS } from './site-config.service';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('SiteConfigService', () => {
  let service: SiteConfigService;
  let settings: jest.Mocked<SettingsService>;
  let redis: jest.Mocked<RedisService>;
  let prisma: { product: { findFirst: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      product: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteConfigService,
        {
          provide: SettingsService,
          useValue: {
            get: jest.fn(),
            getJson: jest.fn(),
            set: jest.fn(),
            setJson: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            getJson: jest.fn(),
            setJson: jest.fn(),
            keys: jest.fn().mockResolvedValue([]),
            exists: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(SiteConfigService);
    settings = module.get(SettingsService);
    redis = module.get(RedisService);
  });

  describe('getTopBar', () => {
    it('serves from Redis cache when present', async () => {
      const cached = {
        messages: [{ text: 'cached', align: 'left' as const }],
      };
      redis.getJson.mockResolvedValue(cached);
      const result = await service.getTopBar();
      expect(result).toEqual(cached);

      expect(settings.getJson).not.toHaveBeenCalledWith('site_topbar');
    });

    it('falls back to DB and warms cache on miss', async () => {
      redis.getJson.mockResolvedValue(null);
      const stored = {
        messages: [{ text: 'from db', align: 'right' as const }],
      };
      settings.getJson.mockResolvedValue(stored);
      const result = await service.getTopBar();
      expect(result).toEqual(stored);
      expect(redis.setJson).toHaveBeenCalledWith(
        'cache:site:topbar',
        stored,
        3600,
      );
    });

    it('returns hardcoded defaults when both cache and DB are empty', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue(null);
      const result = await service.getTopBar();
      expect(result).toEqual(DEFAULTS.topBar);
    });
  });

  describe('setTopBar', () => {
    it('persists to DB and invalidates cache', async () => {
      const dto = {
        messages: [
          { text: 'new', align: 'left' as const },
          { text: 'also new', align: 'right' as const },
        ],
      };
      await service.setTopBar(dto);
      expect(settings.setJson).toHaveBeenCalledWith('site_topbar', dto);
      expect(redis.del).toHaveBeenCalledWith('cache:site:topbar');
    });

    it('rejects messages with invalid align value', async () => {
      const bad = {
        messages: [{ text: 'oops', align: 'middle' as unknown as 'left' }],
      };
      await expect(service.setTopBar(bad)).rejects.toThrow(BadRequestException);
      expect(settings.setJson).not.toHaveBeenCalled();
    });

    it('rejects empty messages array', async () => {
      await expect(service.setTopBar({ messages: [] })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMarquee', () => {
    it('returns defaults when key is missing', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue(null);
      const result = await service.getMarquee();
      expect(result).toEqual(DEFAULTS.marquee);
    });

    it('serves from cache when warm', async () => {
      const cached = { items: ['CACHED'] };
      redis.getJson.mockResolvedValue(cached);
      const result = await service.getMarquee();
      expect(result).toEqual(cached);
    });
  });

  describe('setMarquee', () => {
    it('persists list of items and invalidates cache', async () => {
      await service.setMarquee({ items: ['A', 'B', 'C'] });
      expect(settings.setJson).toHaveBeenCalledWith('site_marquee', {
        items: ['A', 'B', 'C'],
      });
      expect(redis.del).toHaveBeenCalledWith('cache:site:marquee');
    });

    it('rejects empty list', async () => {
      await expect(service.setMarquee({ items: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('trims whitespace and rejects items that become empty', async () => {
      await expect(
        service.setMarquee({ items: ['ok', '   ', 'ok2'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getGeneral', () => {
    it('returns defaults when no record exists', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue(null);
      const result = await service.getGeneral();
      expect(result).toEqual(DEFAULTS.general);
    });

    it('returns stored record from cache (with backfilled new fields)', async () => {
      const cached = {
        siteName: 'Custom',
        siteTagline: 'Custom tagline',
        ogImageUrl: null,
        loginFeaturedProductId: null,
        loginBadgeFeatured: 'FEATURED',
        loginBadgeFallback: 'LIMITED EDITION',
        loginFallbackTitle: 'Aurora · Cyber Vixen',
        loginSubtitle: 'Sign up and get a welcome coupon',
      };
      redis.getJson.mockResolvedValue(cached);
      const result = await service.getGeneral();
      expect(result).toEqual(cached);
    });

    it('backfills missing ogImageUrl=null on legacy records (pre-#49 save)', async () => {
      const legacyRecord = {
        siteName: 'Custom',
        siteTagline: 'Custom tagline',

      };
      redis.getJson.mockResolvedValue(legacyRecord);
      const result = await service.getGeneral();
      expect(result.ogImageUrl).toBeNull();
    });
  });

  describe('setGeneral', () => {
    it('persists and invalidates cache', async () => {
      const dto = {
        siteName: 'Red Figure',
        siteTagline: 'Tagline',
      };
      await service.setGeneral(dto);
      expect(settings.setJson).toHaveBeenCalledWith('site_general', {
        siteName: 'Red Figure',
        siteTagline: 'Tagline',
        ogImageUrl: null,
        loginFeaturedProductId: null,
        loginBadgeFeatured: 'FEATURED',
        loginBadgeFallback: 'LIMITED EDITION',
        loginFallbackTitle: 'Aurora · Cyber Vixen',
        loginSubtitle: 'Sign up and get a welcome coupon',
      });
      expect(redis.del).toHaveBeenCalledWith('cache:site:general');
    });

    it('rejects empty siteName', async () => {
      await expect(
        service.setGeneral({
          siteName: '',
          siteTagline: 'Y',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setGeneral — ogImageUrl (Open Graph default)', () => {
    it('defaults ogImageUrl to null in DEFAULTS', () => {
      expect(DEFAULTS.general.ogImageUrl).toBeNull();
    });

    it('persists a valid https URL', async () => {
      const dto = {
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: 'https://cdn.redfigure.com/og/default.jpg',
      };
      await service.setGeneral(dto);
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({
          siteName: 'Elite',
          siteTagline: 'T',
          ogImageUrl: 'https://cdn.redfigure.com/og/default.jpg',
          loginFeaturedProductId: null,
        }),
      );
    });

    it('persists a valid http URL (non-prod environments)', async () => {
      await service.setGeneral({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: 'http://localhost:3000/og.png',
      });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({
          ogImageUrl: 'http://localhost:3000/og.png',
        }),
      );
    });

    it('normalizes empty string to null', async () => {
      await service.setGeneral({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: '',
      });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({ ogImageUrl: null }),
      );
    });

    it('normalizes whitespace-only string to null', async () => {
      await service.setGeneral({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: '   ',
      });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({ ogImageUrl: null }),
      );
    });

    it('trims whitespace around a valid URL', async () => {
      await service.setGeneral({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: '  https://cdn.x.com/og.jpg  ',
      });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({ ogImageUrl: 'https://cdn.x.com/og.jpg' }),
      );
    });

    it('accepts null explicitly', async () => {
      await service.setGeneral({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: null,
      });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({ ogImageUrl: null }),
      );
    });

    it('rejects a string that is not a URL', async () => {
      await expect(
        service.setGeneral({
          siteName: 'Elite',
          siteTagline: 'T',
          ogImageUrl: 'not-a-url',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(settings.setJson).not.toHaveBeenCalled();
    });

    it('rejects protocols other than http/https (javascript: XSS attempt)', async () => {
      await expect(
        service.setGeneral({
          siteName: 'Elite',
          siteTagline: 'T',
          ogImageUrl: 'javascript:alert(1)' as string,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects data: URLs (avoid 100kb+ payloads inlined in meta)', async () => {
      await expect(
        service.setGeneral({
          siteName: 'Elite',
          siteTagline: 'T',
          ogImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setGeneral — loginFeaturedProductId', () => {
    it('defaults loginFeaturedProductId to null in DEFAULTS', () => {
      expect(DEFAULTS.general.loginFeaturedProductId).toBeNull();
    });

    it('persists null explicitly', async () => {
      await service.setGeneral({
        siteName: 'Elite',
        siteTagline: 'T',
        loginFeaturedProductId: null,
      });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({ loginFeaturedProductId: null }),
      );
    });

    it('normalizes empty string to null without touching DB', async () => {
      await service.setGeneral({
        siteName: 'Elite',
        siteTagline: 'T',
        loginFeaturedProductId: '',
      });
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({ loginFeaturedProductId: null }),
      );
    });

    it('persists a valid product id (active, non-draft, has image)', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1' });
      await service.setGeneral({
        siteName: 'Elite',
        siteTagline: 'T',
        loginFeaturedProductId: 'prod-1',
      });
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'prod-1', isActive: true, isDraft: false },
        select: { id: true },
      });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({ loginFeaturedProductId: 'prod-1' }),
      );
    });

    it('rejects product id that does not exist or is inactive/draft', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(
        service.setGeneral({
          siteName: 'Elite',
          siteTagline: 'T',
          loginFeaturedProductId: 'ghost-id',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(settings.setJson).not.toHaveBeenCalled();
    });

    it('trims whitespace before validation', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-2' });
      await service.setGeneral({
        siteName: 'Elite',
        siteTagline: 'T',
        loginFeaturedProductId: '  prod-2  ',
      });
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'prod-2', isActive: true, isDraft: false },
        select: { id: true },
      });
    });
  });

  describe('setGeneral — login side art copy', () => {
    it('defaults login copy fields in DEFAULTS.general', () => {
      expect(DEFAULTS.general.loginBadgeFeatured).toBe('FEATURED');
      expect(DEFAULTS.general.loginBadgeFallback).toBe('LIMITED EDITION');
      expect(DEFAULTS.general.loginFallbackTitle).toBe('Aurora · Cyber Vixen');
      expect(DEFAULTS.general.loginSubtitle).toBe(
        'Sign up and get a welcome coupon',
      );
    });

    it('persists provided values trimmed', async () => {
      await service.setGeneral({
        siteName: 'X',
        siteTagline: 'Y',
        loginBadgeFeatured: '  TOP  ',
        loginBadgeFallback: 'SHORTLY',
        loginFallbackTitle: 'Featured model',
        loginSubtitle: 'Sign up and receive news',
      });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({
          loginBadgeFeatured: 'TOP',
          loginBadgeFallback: 'SHORTLY',
          loginFallbackTitle: 'Featured model',
          loginSubtitle: 'Sign up and receive news',
        }),
      );
    });

    it('falls back to project defaults when fields are undefined', async () => {
      await service.setGeneral({ siteName: 'X', siteTagline: 'Y' });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({
          loginBadgeFeatured: 'FEATURED',
          loginBadgeFallback: 'LIMITED EDITION',
          loginFallbackTitle: 'Aurora · Cyber Vixen',
          loginSubtitle: 'Sign up and get a welcome coupon',
        }),
      );
    });

    it('allows empty string (admin hides the element)', async () => {
      await service.setGeneral({
        siteName: 'X',
        siteTagline: 'Y',
        loginSubtitle: '',
      });
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_general',
        expect.objectContaining({ loginSubtitle: '' }),
      );
    });

    it('rejects loginBadgeFeatured > 40 chars', async () => {
      await expect(
        service.setGeneral({
          siteName: 'X',
          siteTagline: 'Y',
          loginBadgeFeatured: 'A'.repeat(41),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(settings.setJson).not.toHaveBeenCalled();
    });

    it('rejects loginBadgeFallback > 40 chars', async () => {
      await expect(
        service.setGeneral({
          siteName: 'X',
          siteTagline: 'Y',
          loginBadgeFallback: 'B'.repeat(41),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects loginFallbackTitle > 80 chars', async () => {
      await expect(
        service.setGeneral({
          siteName: 'X',
          siteTagline: 'Y',
          loginFallbackTitle: 'C'.repeat(81),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects loginSubtitle > 160 chars', async () => {
      await expect(
        service.setGeneral({
          siteName: 'X',
          siteTagline: 'Y',
          loginSubtitle: 'D'.repeat(161),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-string values', async () => {
      await expect(
        service.setGeneral({
          siteName: 'X',
          siteTagline: 'Y',
          loginBadgeFeatured: 42 as unknown as string,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('backfills login copy on legacy records via getGeneral', async () => {
      const legacyRecord = { siteName: 'X', siteTagline: 'Y' };
      redis.getJson.mockResolvedValue(legacyRecord);
      const result = await service.getGeneral();
      expect(result.loginBadgeFeatured).toBe('FEATURED');
      expect(result.loginBadgeFallback).toBe('LIMITED EDITION');
      expect(result.loginFallbackTitle).toBe('Aurora · Cyber Vixen');
      expect(result.loginSubtitle).toBe(
        'Sign up and get a welcome coupon',
      );
    });
  });

  describe('setGeneral — invalidates login-featured cache', () => {
    it('clears the login-featured Redis cache on save', async () => {
      await service.setGeneral({ siteName: 'X', siteTagline: 'Y' });
      expect(redis.del).toHaveBeenCalledWith('cache:site:login-featured');
    });
  });

  describe('getLoginFeaturedProduct', () => {
    const productWithImage = {
      id: 'prod-1',
      name: 'Aurora · Cyber Vixen',
      slug: 'aurora-cyber-vixen',
      images: [
        {
          isMain: true,
          order: 0,
          mediaFile: {
            gallery: 'https://cdn.x/aurora-gallery.webp',
            alt: 'Aurora pinup',
          },
        },
      ],
    };

    it('returns the explicitly selected product when valid + has image', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: null,
        loginFeaturedProductId: 'prod-1',
      });
      prisma.product.findFirst.mockResolvedValue(productWithImage);
      const result = await service.getLoginFeaturedProduct();
      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1', isActive: true, isDraft: false },
        }),
      );
      expect(result).toEqual({
        id: 'prod-1',
        name: 'Aurora · Cyber Vixen',
        slug: 'aurora-cyber-vixen',
        imageUrl: 'https://cdn.x/aurora-gallery.webp',
        alt: 'Aurora pinup',
      });
    });

    it('falls back to random featured when selected id no longer exists', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: null,
        loginFeaturedProductId: 'gone',
      });

      prisma.product.findFirst.mockResolvedValueOnce(null);

      prisma.product.findMany.mockResolvedValue([productWithImage]);
      const result = await service.getLoginFeaturedProduct();
      expect(result).toEqual(
        expect.objectContaining({
          id: 'prod-1',
          imageUrl: 'https://cdn.x/aurora-gallery.webp',
        }),
      );
    });

    it('falls back when selected product has no image', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: null,
        loginFeaturedProductId: 'no-img',
      });
      prisma.product.findFirst.mockResolvedValueOnce({
        id: 'no-img',
        name: 'No Image',
        slug: 'no-img',
        images: [],
      });
      prisma.product.findMany.mockResolvedValue([productWithImage]);
      const result = await service.getLoginFeaturedProduct();
      expect(result?.id).toBe('prod-1');
    });

    it('returns random featured when nothing is selected', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: null,
        loginFeaturedProductId: null,
      });
      prisma.product.findMany.mockResolvedValue([productWithImage]);
      const result = await service.getLoginFeaturedProduct();
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { featured: true, isActive: true, isDraft: false },
        }),
      );
      expect(result?.id).toBe('prod-1');
    });

    it('returns null when there are no featured products either', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: null,
        loginFeaturedProductId: null,
      });
      prisma.product.findMany.mockResolvedValue([]);
      const result = await service.getLoginFeaturedProduct();
      expect(result).toBeNull();
    });

    it('skips fallback featured products that have no image', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: null,
        loginFeaturedProductId: null,
      });
      prisma.product.findMany.mockResolvedValue([
        { id: 'a', name: 'A', slug: 'a', images: [] },
        productWithImage,
      ]);
      const result = await service.getLoginFeaturedProduct();
      expect(result?.id).toBe('prod-1');
    });

    it('serves from Redis cache without hitting DB on cache hit', async () => {
      const cachedDto = {
        id: 'prod-1',
        name: 'Aurora · Cyber Vixen',
        slug: 'aurora-cyber-vixen',
        imageUrl: 'https://cdn.x/aurora-gallery.webp',
        alt: 'Aurora pinup',
      };

      redis.getJson.mockImplementation(async (key: string) => {
        if (key === 'cache:site:login-featured') return { value: cachedDto };
        return null;
      });
      const result = await service.getLoginFeaturedProduct();
      expect(result).toEqual(cachedDto);
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('serves cached null without hitting DB (cache penetration defense)', async () => {
      redis.getJson.mockImplementation(async (key: string) => {
        if (key === 'cache:site:login-featured') return { value: null };
        return null;
      });
      const result = await service.getLoginFeaturedProduct();
      expect(result).toBeNull();
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('warms cache (envelope) after computing a hit', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: null,
        loginFeaturedProductId: 'prod-1',
      });
      prisma.product.findFirst.mockResolvedValue(productWithImage);
      await service.getLoginFeaturedProduct();
      expect(redis.setJson).toHaveBeenCalledWith(
        'cache:site:login-featured',
        { value: expect.objectContaining({ id: 'prod-1' }) },
        60,
      );
    });

    it('caches null result too (prevents cache penetration DoS)', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        siteName: 'Elite',
        siteTagline: 'T',
        ogImageUrl: null,
        loginFeaturedProductId: null,
      });
      prisma.product.findMany.mockResolvedValue([]);
      const result = await service.getLoginFeaturedProduct();
      expect(result).toBeNull();
      expect(redis.setJson).toHaveBeenCalledWith(
        'cache:site:login-featured',
        { value: null },
        60,
      );
    });
  });

  describe('getMegaMenu', () => {
    it('returns defaults when no record', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue(null);
      const result = await service.getMegaMenu();
      expect(result).toEqual(DEFAULTS.megaMenu);
    });
  });

  describe('setMegaMenu', () => {
    it('persists valid menu and invalidates cache', async () => {
      const dto = {
        items: [
          { id: 'home', label: 'Home', href: '/' },
          { id: 'cat', label: 'Catalog', href: '/products' },
        ],
      };
      await service.setMegaMenu(dto);
      expect(settings.setJson).toHaveBeenCalledWith('site_megamenu', dto);
      expect(redis.del).toHaveBeenCalledWith('cache:site:megamenu');
    });

    it('rejects items with duplicated id', async () => {
      await expect(
        service.setMegaMenu({
          items: [
            { id: 'a', label: 'A', href: '/a' },
            { id: 'a', label: 'A2', href: '/a2' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects item with empty label', async () => {
      await expect(
        service.setMegaMenu({
          items: [{ id: 'a', label: '', href: '/a' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid badge', async () => {
      await expect(
        service.setMegaMenu({
          items: [
            {
              id: 'a',
              label: 'A',
              href: '/a',
              badge: 'INVALID' as unknown as 'NEW',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates nested columns and links', async () => {
      await expect(
        service.setMegaMenu({
          items: [
            {
              id: 'a',
              label: 'A',
              href: '/a',
              columns: [
                {
                  title: 'COL',
                  links: [{ label: '', href: '/x' }],
                },
              ],
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFooter', () => {
    it('returns defaults when no record', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue(null);
      const result = await service.getFooter();
      expect(result).toEqual(DEFAULTS.footer);
    });
  });

  describe('setFooter', () => {
    it('persists valid footer and invalidates cache', async () => {
      const dto = {
        columns: [
          {
            title: 'STORE',
            links: [{ label: 'Catalog', href: '/products' }],
          },
        ],
        socials: [
          {
            platform: 'instagram' as const,
            href: 'https://instagram.com/x',
          },
        ],
        legal: { copyright: '© 2026 X' },
      };
      await service.setFooter(dto);
      expect(settings.setJson).toHaveBeenCalledWith('site_footer', dto);
      expect(redis.del).toHaveBeenCalledWith('cache:site:footer');
    });

    it('rejects column without title', async () => {
      await expect(
        service.setFooter({
          columns: [{ title: '', links: [] }],
          socials: [],
          legal: { copyright: '© 2026' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid social platform', async () => {
      await expect(
        service.setFooter({
          columns: [],
          socials: [
            {
              platform: 'myspace' as unknown as 'instagram',
              href: 'https://x',
            },
          ],
          legal: { copyright: '© 2026' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty copyright', async () => {
      await expect(
        service.setFooter({
          columns: [],
          socials: [],
          legal: { copyright: '' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getHomeBlocks', () => {
    it('returns defaults (11 blocks) when key is empty in DB', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue(null);
      const result = await service.getHomeBlocks();
      expect(result.blocks).toHaveLength(11);

      expect(result.blocks.map((b) => b.type)).toEqual([
        'hero-carousel',
        'categories-strip',
        'latest-products',
        'featured-products',
        'promo-banner',
        'how-it-works',
        'custom-quote',
        'reviews',
        'faq',
        'trust-strip',
        'newsletter',
      ]);
      expect(result.blocks.every((b) => b.isActive)).toBe(true);
      expect(result.blocks[0].order).toBe(0);
      expect(result.blocks[10].order).toBe(10);
    });

    it('serves Redis cache when present', async () => {
      const cached = { blocks: [] };
      redis.getJson.mockResolvedValue(cached);
      const result = await service.getHomeBlocks();
      expect(result).toEqual(cached);

      expect(settings.getJson).not.toHaveBeenCalledWith('site_home_blocks');
    });

    it('defensive parse drops block with unknown type', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        blocks: [
          {
            id: 'a',
            type: 'unknown-type',
            order: 0,
            isActive: true,
            data: {},
          },
          {
            id: 'b',
            type: 'newsletter',
            order: 1,
            isActive: true,
            data: {
              eyebrow: 'Eyebrow',
              title: 'Title',
              description: 'Desc',
              ctaLabel: 'Go',
            },
          },
        ],
      });
      const result = await service.getHomeBlocks();
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('newsletter');
      expect(result.blocks[0].order).toBe(0);
    });

    it('defensive parse returns defaults when array is empty (all invalid)', async () => {
      redis.getJson.mockResolvedValue(null);
      settings.getJson.mockResolvedValue({
        blocks: [
          {
            id: 'x',
            type: 'totally-invalid',
            order: 0,
            isActive: true,
            data: {},
          },
        ],
      });
      const result = await service.getHomeBlocks();
      expect(result.blocks).toHaveLength(11);
    });
  });

  describe('setHomeBlocks', () => {
    const validBlock = {
      id: 'block-1',
      type: 'newsletter',
      order: 0,
      isActive: true,
      data: {
        eyebrow: 'Eye',
        title: 'Title',
        description: 'Desc',
        ctaLabel: 'Go',
      },
    };

    it('persists valid blocks + invalidates cache', async () => {
      const result = await service.setHomeBlocks([validBlock]);
      expect(result.blocks).toHaveLength(1);
      expect(settings.setJson).toHaveBeenCalledWith(
        'site_home_blocks',
        expect.objectContaining({ blocks: expect.any(Array) }),
      );
      expect(redis.del).toHaveBeenCalledWith('cache:site:home-blocks');
    });

    it('renumbers order 0..N-1 even if input has gaps', async () => {
      const blocks = [
        { ...validBlock, id: 'a', order: 7 },
        {
          ...validBlock,
          id: 'b',
          order: 23,
          type: 'trust-strip',
          data: {
            badges: [{ icon: 'shipping', title: 'A', description: 'd' }],
          },
        },
        { ...validBlock, id: 'c', order: 0 },
      ];
      const result = await service.setHomeBlocks(blocks);
      expect(result.blocks.map((b) => b.order)).toEqual([0, 1, 2]);

      expect(result.blocks.map((b) => b.id)).toEqual(['c', 'a', 'b']);
    });

    it('rejects duplicate IDs', async () => {
      await expect(
        service.setHomeBlocks([
          { ...validBlock, id: 'dup' },
          { ...validBlock, id: 'dup', order: 1 },
        ]),
      ).rejects.toThrow(/duplicate/);
    });

    it('rejects unknown type', async () => {
      await expect(
        service.setHomeBlocks([{ ...validBlock, type: 'bogus' }]),
      ).rejects.toThrow(/unknown type/);
    });

    it('rejects empty array', async () => {
      await expect(service.setHomeBlocks([])).rejects.toThrow(
        /at least 1 block/,
      );
    });

    it('rejects invalid data shape with precise fieldName', async () => {
      try {
        await service.setHomeBlocks([
          {
            ...validBlock,
            type: 'promo-banner',
            data: { cards: [{ theme: 'red' }] },
          },
        ]);
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = (err as BadRequestException).getResponse() as {
          fieldName: string;
        };
        expect(resp.fieldName).toContain('cards[0]');
      }
    });

    it('applies stripBidi to texts (anti-UI spoof)', async () => {

      const titleWithBidi = `‮Hack`;
      await service.setHomeBlocks([
        {
          ...validBlock,
          data: {
            ...validBlock.data,
            title: titleWithBidi,
          },
        },
      ]);
      const persisted = settings.setJson.mock.calls[0]?.[1] as {
        blocks: Array<{ data: { title: string } }>;
      };
      expect(persisted.blocks[0].data.title).toBe('Hack');
    });
  });

  describe('invalidateHomeBlocksCache', () => {
    it('calls redis.del on the correct key', async () => {
      await service.invalidateHomeBlocksCache();
      expect(redis.del).toHaveBeenCalledWith('cache:site:home-blocks');
    });

    it('swallows redis error to not break the caller', async () => {
      redis.del.mockRejectedValueOnce(new Error('redis down'));
      await expect(
        service.invalidateHomeBlocksCache(),
      ).resolves.toBeUndefined();
    });
  });

  describe('flushAllCaches (Clear cache button in admin)', () => {
    const sampleKeys = [
      'cache:site:topbar',
      'cache:site:marquee',
      'cache:site:general',
      'cache:site:megamenu',
      'cache:site:footer',
      'cache:site:home-blocks',
      'cache:site:home-blocks:hydrated',
      'cache:site:login-featured',
      'cache:categories:tree:v1',
      'cache:product:slug:miniatura-x',
      'cache:settings:bulk:v1',
      'cache:shipping:quote:abc',
    ];

    it('does SCAN cache:* + parallel DEL + EXISTS verify (read-back)', async () => {
      redis.keys.mockResolvedValue([...sampleKeys]);
      redis.exists.mockResolvedValue(false);

      const result = await service.flushAllCaches();

      expect(redis.keys).toHaveBeenCalledWith('cache:*');

      for (const key of sampleKeys) {
        expect(redis.del).toHaveBeenCalledWith(key);

        expect(redis.exists).toHaveBeenCalledWith(key);
      }
      expect(result).toEqual({
        flushed: sampleKeys,
        failed: [],
        scannedCount: sampleKeys.length,
      });
    });

    it('when EXISTS returns true (key survived), marks as failed', async () => {
      redis.keys.mockResolvedValue(['cache:site:topbar', 'cache:site:footer']);

      redis.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const result = await service.flushAllCaches();

      expect(result.flushed).toEqual(['cache:site:topbar']);
      expect(result.failed).toEqual(['cache:site:footer']);
      expect(result.scannedCount).toBe(2);
    });

    it('when DEL fails, marks key as failed but continues processing the rest', async () => {
      redis.keys.mockResolvedValue(['cache:site:topbar', 'cache:site:footer']);
      redis.del.mockRejectedValueOnce(new Error('redis flaky'));
      redis.exists.mockResolvedValue(false);

      const result = await service.flushAllCaches();

      expect(result.flushed).toEqual(['cache:site:footer']);
      expect(result.failed).toEqual(['cache:site:topbar']);
      expect(result.scannedCount).toBe(2);
    });

    it('when KEYS scan fails, propagates error (without this info it is not possible to flush)', async () => {
      redis.keys.mockRejectedValue(new Error('connection lost'));
      await expect(service.flushAllCaches()).rejects.toThrow('connection lost');
    });

    it('when 0 keys scanned, returns { flushed:[], failed:[], scannedCount:0 } without calling DEL', async () => {
      redis.keys.mockResolvedValue([]);
      const result = await service.flushAllCaches();
      expect(result).toEqual({ flushed: [], failed: [], scannedCount: 0 });
      expect(redis.del).not.toHaveBeenCalled();
      expect(redis.exists).not.toHaveBeenCalled();
    });
  });

  describe('isCacheDisabled (toggle admin)', () => {
    it('returns false by default when setting was never set', async () => {
      settings.getJson.mockResolvedValue(null);
      await expect(service.isCacheDisabled()).resolves.toBe(false);
    });

    it('returns true when site_cache_disabled setting === true', async () => {
      settings.getJson.mockResolvedValue(true);
      await expect(service.isCacheDisabled()).resolves.toBe(true);
    });

    it('returns false when setting has non-true value (defensive)', async () => {
      settings.getJson.mockResolvedValue('yes' as unknown as boolean);
      await expect(service.isCacheDisabled()).resolves.toBe(false);
    });

    it('returns false (fail-safe) when getJson throws', async () => {
      settings.getJson.mockRejectedValue(new Error('db down'));
      await expect(service.isCacheDisabled()).resolves.toBe(false);
    });
  });

  describe('setCacheDisabled (toggle admin)', () => {
    it('persists setting + flushes cache when set to true', async () => {
      redis.keys.mockResolvedValue(['cache:site:topbar']);
      redis.exists.mockResolvedValue(false);

      const result = await service.setCacheDisabled(true);

      expect(settings.setJson).toHaveBeenCalledWith(
        'site_cache_disabled',
        true,
      );
      expect(redis.keys).toHaveBeenCalledWith('cache:*');
      expect(redis.del).toHaveBeenCalledWith('cache:site:topbar');
      expect(result).toEqual({ disabled: true });
    });

    it('persists setting WITHOUT flushing when set to false', async () => {
      const result = await service.setCacheDisabled(false);

      expect(settings.setJson).toHaveBeenCalledWith(
        'site_cache_disabled',
        false,
      );
      expect(redis.keys).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
      expect(result).toEqual({ disabled: false });
    });

    it('persists setting even if flush post-toggle fails (fail-soft)', async () => {
      redis.keys.mockRejectedValue(new Error('redis exploded'));

      const result = await service.setCacheDisabled(true);

      expect(settings.setJson).toHaveBeenCalledWith(
        'site_cache_disabled',
        true,
      );
      expect(result).toEqual({ disabled: true });
    });
  });

  describe('readWithCache respects isCacheDisabled', () => {

    it('getTopBar skips cache (read+write) when cacheDisabled=true', async () => {
      settings.getJson.mockImplementation(async (key: string) => {
        if (key === 'site_cache_disabled') return true as never;
        return null as never;
      });

      await service.getTopBar();

      expect(redis.getJson).not.toHaveBeenCalled();
      expect(redis.setJson).not.toHaveBeenCalled();
    });

    it('getTopBar uses normal cache when cacheDisabled=false', async () => {
      settings.getJson.mockResolvedValue(null);
      redis.getJson.mockResolvedValue(null);

      await service.getTopBar();

      expect(redis.getJson).toHaveBeenCalledWith('cache:site:topbar');
    });
  });

  describe('home-blocks URL scheme validation (Gemini round 1)', () => {
    it('rejects ctaHref with javascript: scheme', async () => {
      await expect(
        service.setHomeBlocks([
          {
            id: 'bad',
            type: 'custom-quote',
            order: 0,
            isActive: true,
            data: {
              eyebrow: 'a',
              title: 'b',
              description: 'c',
              ctaLabel: 'd',
              ctaHref: 'javascript:alert(1)',
              steps: [
                { number: '01', title: 't', description: 'd' },
                { number: '02', title: 't', description: 'd' },
                { number: '03', title: 't', description: 'd' },
                { number: '04', title: 't', description: 'd' },
              ],
            },
          },
        ]),
      ).rejects.toThrow(/protocol .* not allowed/i);
    });

    it('rejects ctaHref with data: scheme', async () => {
      await expect(
        service.setHomeBlocks([
          {
            id: 'bad',
            type: 'custom-quote',
            order: 0,
            isActive: true,
            data: {
              eyebrow: 'a',
              title: 'b',
              description: 'c',
              ctaLabel: 'd',
              ctaHref: 'data:text/html,<script>x</script>',
              steps: [
                { number: '01', title: 't', description: 'd' },
                { number: '02', title: 't', description: 'd' },
                { number: '03', title: 't', description: 'd' },
                { number: '04', title: 't', description: 'd' },
              ],
            },
          },
        ]),
      ).rejects.toThrow(/protocol .* not allowed/i);
    });

    it('rejects protocol-relative URL', async () => {
      await expect(
        service.setHomeBlocks([
          {
            id: 'bad',
            type: 'custom-quote',
            order: 0,
            isActive: true,
            data: {
              eyebrow: 'a',
              title: 'b',
              description: 'c',
              ctaLabel: 'd',
              ctaHref: '
              steps: [
                { number: '01', title: 't', description: 'd' },
                { number: '02', title: 't', description: 'd' },
                { number: '03', title: 't', description: 'd' },
                { number: '04', title: 't', description: 'd' },
              ],
            },
          },
        ]),
      ).rejects.toThrow(/protocol-relative/i);
    });

    it('accepts relative path /products', async () => {
      await expect(
        service.setHomeBlocks([
          {
            id: 'ok',
            type: 'custom-quote',
            order: 0,
            isActive: true,
            data: {
              eyebrow: 'a',
              title: 'b',
              description: 'c',
              ctaLabel: 'd',
              ctaHref: '/products',
              steps: [
                { number: '01', title: 't', description: 'd' },
                { number: '02', title: 't', description: 'd' },
                { number: '03', title: 't', description: 'd' },
                { number: '04', title: 't', description: 'd' },
              ],
            },
          },
        ]),
      ).resolves.toBeDefined();
    });

    it('accepts https://example.com', async () => {
      await expect(
        service.setHomeBlocks([
          {
            id: 'ok',
            type: 'custom-quote',
            order: 0,
            isActive: true,
            data: {
              eyebrow: 'a',
              title: 'b',
              description: 'c',
              ctaLabel: 'd',
              ctaHref: 'https://example.com/page',
              steps: [
                { number: '01', title: 't', description: 'd' },
                { number: '02', title: 't', description: 'd' },
                { number: '03', title: 't', description: 'd' },
                { number: '04', title: 't', description: 'd' },
              ],
            },
          },
        ]),
      ).resolves.toBeDefined();
    });
  });

  it('DEFAULTS.homeBlocks: trust-strip texts come from handoff index.html', () => {
    const trust = (
      DEFAULTS.homeBlocks.blocks as Array<{
        type: string;
        data: { badges?: Array<{ icon: string; title: string }> };
      }>
    ).find((b) => b.type === 'trust-strip');
    expect(trust?.data.badges).toEqual([
      {
        icon: 'shipping',
        title: 'Discreet Shipping',
        description: expect.any(String),
      },
      {
        icon: 'shield',
        title: '30-day Warranty',
        description: expect.any(String),
      },
      { icon: 'age', title: '+18 Verified', description: expect.any(String) },
    ]);
  });
});
