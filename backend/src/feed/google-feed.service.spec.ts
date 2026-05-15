import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleFeedService, stripHtml } from './google-feed.service';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantFieldsService } from '../products/merchant-fields.service';
import { FEED_CACHE, type FeedCache } from './feed-cache';

class MemoryCache implements FeedCache {
  private store = new Map<string, string>();
  public lastTtl?: number;

  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    this.store.set(key, value);
    this.lastTtl = ttlSeconds;
  }
}

const SITE_URL = 'https://redfigure.com';

const baseProduct = {
  id: 'prod1',
  sku: 'WAR-001',
  name: 'Elven Warrior',
  slug: 'elven-warrior',
  description: '<p>Incredible resin miniature.</p>',
  shortDescription: 'Resin miniature',
  basePrice: 49.9,
  salePrice: null,
  stock: 10,
  manageStock: true,
  isActive: true,
  condition: 'new',
  gtin: null,
  mpn: null,
  googleCategory: null,
  color: null,
  material: null,
  brand: null,
  images: [
    {
      isMain: true,
      mediaFile: { full: 'https://cdn.redfigure.com/img/elf-full.webp' },
    },
  ],
};

describe('GoogleFeedService', () => {
  let service: GoogleFeedService;
  let prisma: any;
  let cache: MemoryCache;

  beforeEach(async () => {
    cache = new MemoryCache();
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([baseProduct]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleFeedService,
        MerchantFieldsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FEED_CACHE, useValue: cache },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'SITE_URL' ? SITE_URL : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<GoogleFeedService>(GoogleFeedService);
  });

  describe('build()', () => {
    it('returns RSS 2.0 envelope with g: namespace', async () => {
      const xml = await service.build();
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain(
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      );
      expect(xml).toContain('<channel>');
      expect(xml).toContain('</channel>');
      expect(xml).toContain('</rss>');
    });

    it('queries only active products', async () => {
      await service.build();
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('emits all required fields for an active product', async () => {
      const xml = await service.build();
      expect(xml).toContain('<g:id>WAR-001</g:id>');
      expect(xml).toContain('<title>Elven Warrior</title>');
      expect(xml).toContain(
        '<g:link>https://redfigure.com/p/elven-warrior</g:link>',
      );
      expect(xml).toContain(
        '<g:image_link>https://cdn.redfigure.com/img/elf-full.webp</g:image_link>',
      );
      expect(xml).toContain('<g:price>49.000 VND</g:price>');
      expect(xml).toContain('<g:availability>in stock</g:availability>');
      expect(xml).toContain('<g:condition>new</g:condition>');
    });

    it('falls back to product.id when SKU is missing', async () => {
      prisma.product.findMany.mockResolvedValue([
        { ...baseProduct, sku: null },
      ]);
      const xml = await service.build();
      expect(xml).toContain('<g:id>prod1</g:id>');
    });

    it('strips HTML and uses shortDescription when available', async () => {
      const xml = await service.build();

      expect(xml).toContain('<description>Resin miniature</description>');
    });

    it('falls back to description (HTML stripped) when shortDescription missing', async () => {
      prisma.product.findMany.mockResolvedValue([
        { ...baseProduct, shortDescription: null },
      ]);
      const xml = await service.build();
      expect(xml).toContain(
        '<description>Amazing miniature made of resin.</description>',
      );
      expect(xml).not.toContain('<strong>');
    });

    it('truncates title to 150 chars', async () => {
      const longName = 'A'.repeat(200);
      prisma.product.findMany.mockResolvedValue([
        { ...baseProduct, name: longName },
      ]);
      const xml = await service.build();
      const match = xml.match(/<title>(.+?)<\/title>/);
      expect(match?.[1].length).toBeLessThanOrEqual(150);
    });

    it('truncates description to 5000 chars (after HTML strip)', async () => {
      const longDesc = 'B'.repeat(6000);
      prisma.product.findMany.mockResolvedValue([
        {
          ...baseProduct,
          shortDescription: null,
          description: longDesc,
        },
      ]);
      const xml = await service.build();
      const match = xml.match(/<description>(.+?)<\/description>/s);
      expect(match?.[1].length).toBeLessThanOrEqual(5000);
    });

    it('escapes XML special characters in title and description', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          ...baseProduct,
          name: 'Sword & Shield <set>',
          shortDescription: 'Quote: "the best" — \'awesome\' & sharp',
        },
      ]);
      const xml = await service.build();
      expect(xml).toContain('Sword &amp; Shield &lt;set&gt;');
      expect(xml).toContain(
        'Quote: &quot;the best&quot; — &apos;awesome&apos; &amp; sharp',
      );

      expect(xml).not.toContain('Sword & Shield');
      expect(xml).not.toContain('"the best"');
    });

    it('omits g:sale_price when salePrice is null', async () => {
      const xml = await service.build();
      expect(xml).not.toContain('<g:sale_price>');
    });

    it('emits g:sale_price when salePrice is present', async () => {
      prisma.product.findMany.mockResolvedValue([
        { ...baseProduct, salePrice: 39.9 },
      ]);
      const xml = await service.build();
      expect(xml).toContain('<g:sale_price>39.000 VND</g:sale_price>');
    });

    it('emits "out of stock" when stock is 0', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...baseProduct, stock: 0 }]);
      const xml = await service.build();
      expect(xml).toContain('<g:availability>out of stock</g:availability>');
    });

    it('omits g:gtin when gtin is null (no empty tag)', async () => {
      const xml = await service.build();
      expect(xml).not.toContain('<g:gtin>');
      expect(xml).not.toContain('<g:gtin/>');
    });

    it('omits g:mpn / g:google_product_category / g:color / g:material / g:brand when null', async () => {
      const xml = await service.build();
      expect(xml).not.toContain('<g:mpn>');
      expect(xml).not.toContain('<g:google_product_category>');
      expect(xml).not.toContain('<g:color>');
      expect(xml).not.toContain('<g:material>');
      expect(xml).not.toContain('<g:brand>');
    });

    it('emits g:gtin / g:mpn / g:brand etc. when present (FK relations)', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          ...baseProduct,
          gtin: '7891234567890',
          mpn: 'MPN-XYZ',
          googleCategory: { path: 'Toys > Dolls > Action figures' },
          color: { name: 'Red' },
          material: { name: 'Resin' },
          brand: { name: 'Red Figure' },
        },
      ]);
      const xml = await service.build();
      expect(xml).toContain('<g:gtin>7891234567890</g:gtin>');
      expect(xml).toContain('<g:mpn>MPN-XYZ</g:mpn>');
      expect(xml).toContain(
        '<g:google_product_category>Toys &gt; Dolls &gt; Action figures</g:google_product_category>',
      );
      expect(xml).toContain('<g:color>Red</g:color>');
      expect(xml).toContain('<g:material>Resin</g:material>');
      expect(xml).toContain('<g:brand>Red Figure</g:brand>');
    });

    it('skips products without any image', async () => {
      prisma.product.findMany.mockResolvedValue([
        { ...baseProduct, images: [] },
      ]);
      const xml = await service.build();
      expect(xml).not.toContain('<g:image_link>');

      expect(xml).not.toContain('<g:id>WAR-001</g:id>');
    });

    it('uses main image when present, otherwise first', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          ...baseProduct,
          images: [
            {
              isMain: false,
              mediaFile: { full: 'https://cdn.test/first.webp' },
            },
            {
              isMain: true,
              mediaFile: { full: 'https://cdn.test/main.webp' },
            },
          ],
        },
      ]);
      const xml = await service.build();
      expect(xml).toContain('<g:image_link>https://cdn.test/main.webp');
    });
  });

  describe('caching', () => {
    it('returns cached value on second call without hitting Prisma', async () => {
      await service.build();
      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);

      await service.build();
      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    });

    it('writes cache with TTL of 3600 seconds', async () => {
      await service.build();
      expect(cache.lastTtl).toBe(3600);
    });
  });
});

describe('stripHtml', () => {
  it('removes simple tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello   <strong>world</strong></p>')).toBe(
      'Hello world',
    );
  });

  it('strips nested tags that survive a single-pass replace', () => {

    const payload = '<scr<script>ipt>alert(1)</script>safe';
    const result = stripHtml(payload);
    expect(result).not.toMatch(/<script/i);
    expect(result).not.toMatch(/<\/script/i);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('strips multiply-nested tags until stable', () => {
    const payload = '<<<div>>><b>x</b><<</div>>>';
    const result = stripHtml(payload);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('handles plain text without tags', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });

  it('returns empty string when input is only tags', () => {
    expect(stripHtml('<p></p><br/>')).toBe('');
  });
});
