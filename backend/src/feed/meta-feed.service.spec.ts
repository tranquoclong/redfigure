import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MetaFeedService } from './meta-feed.service';
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

describe('MetaFeedService', () => {
  let service: MetaFeedService;
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
        MetaFeedService,
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

    service = module.get<MetaFeedService>(MetaFeedService);
  });

  it('queries only active products', async () => {
    await service.build();
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('emits one JSON object per line (JSONL)', async () => {
    prisma.product.findMany.mockResolvedValue([
      baseProduct,
      { ...baseProduct, id: 'prod2', sku: 'WAR-002' },
    ]);
    const out = await service.build();
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    lines.forEach((line) => {
      expect(() => JSON.parse(line)).not.toThrow();
    });
  });

  it('produces Meta Catalog snake_case fields with required values', async () => {
    const out = await service.build();
    const item = JSON.parse(out);
    expect(item).toEqual({
      id: 'WAR-001',
      title: 'Elven Warrior',
      description: 'Resin miniature',
      link: 'https://redfigure.com/p/elven-warrior',
      image_link: 'https://cdn.redfigure.com/img/elf-full.webp',
      price: '49.000 VND',
      availability: 'in stock',
      condition: 'new',
    });
  });

  it('falls back to product.id when SKU is missing', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...baseProduct, sku: null }]);
    const out = await service.build();
    expect(JSON.parse(out).id).toBe('prod1');
  });

  it('strips HTML from description fallback', async () => {
    prisma.product.findMany.mockResolvedValue([
      { ...baseProduct, shortDescription: null },
    ]);
    const out = await service.build();
    expect(JSON.parse(out).description).toBe('Incredible resin miniature.');
  });

  it('omits sale_price/brand/gtin/mpn/google_product_category/color/material when null', async () => {
    const out = await service.build();
    const item = JSON.parse(out);
    expect(item).not.toHaveProperty('sale_price');
    expect(item).not.toHaveProperty('brand');
    expect(item).not.toHaveProperty('gtin');
    expect(item).not.toHaveProperty('mpn');
    expect(item).not.toHaveProperty('google_product_category');
    expect(item).not.toHaveProperty('color');
    expect(item).not.toHaveProperty('material');
  });

  it('emits all optional fields when present (FK relations)', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        ...baseProduct,
        salePrice: 39.9,
        gtin: '7891234567890',
        mpn: 'MPN-XYZ',
        googleCategory: { path: 'Toys > Action Figures' },
        color: { name: 'Red' },
        material: { name: 'Resin' },
        brand: { name: 'Arsenal Craft' },
      },
    ]);
    const out = await service.build();
    const item = JSON.parse(out);
    expect(item.sale_price).toBe('39.000 VND');
    expect(item.gtin).toBe('7891234567890');
    expect(item.mpn).toBe('MPN-XYZ');
    expect(item.google_product_category).toBe('Toys > Action Figures');
    expect(item.color).toBe('Red');
    expect(item.material).toBe('Resin');
    expect(item.brand).toBe('Arsenal Craft');
  });

  it('marks out of stock when stock is 0', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...baseProduct, stock: 0 }]);
    const out = await service.build();
    expect(JSON.parse(out).availability).toBe('out of stock');
  });

  it('skips products without images', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...baseProduct, images: [] }]);
    const out = await service.build();
    expect(out).toBe('');
  });

  it('caches result for 3600 seconds', async () => {
    await service.build();
    expect(cache.lastTtl).toBe(3600);
    await service.build();
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
  });
});
