import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantFieldsService } from '../products/merchant-fields.service';
import { FEED_CACHE, type FeedCache } from './feed-cache';
import { stripHtml } from './google-feed.service';

const CACHE_KEY = 'feed:meta:v1';
const CACHE_TTL_SECONDS = 3600;
const DEFAULT_SITE_URL = 'https://redfigure.com';

interface FeedProduct {
  id: string;
  sku: string | null;
  name: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  basePrice: number;
  salePrice: number | null;
  stock: number;
  manageStock: boolean;
  isActive: boolean;
  condition: string;
  gtin: string | null;
  mpn: string | null;
  googleCategory: { path: string } | null;
  color: { name: string } | null;
  material: { name: string } | null;
  brand: { name: string } | null;
  images: Array<{
    isMain: boolean;
    mediaFile: { full: string };
  }>;
}

interface MetaCatalogItem {
  id: string;
  title: string;
  description: string;
  link: string;
  image_link: string;
  price: string;
  sale_price?: string;
  availability: 'in stock' | 'out of stock';
  condition: string;
  brand?: string;
  gtin?: string;
  mpn?: string;
  google_product_category?: string;
  color?: string;
  material?: string;
}

@Injectable()
export class MetaFeedService {
  private readonly logger = new Logger(MetaFeedService.name);
  private readonly siteUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FEED_CACHE) private readonly cache: FeedCache,
    private readonly config: ConfigService,
    private readonly merchantFieldsService: MerchantFieldsService,
  ) {
    this.siteUrl = this.config.get<string>('SITE_URL') ?? DEFAULT_SITE_URL;
  }

  async build(): Promise<string> {
    const cached = await this.cache.get(CACHE_KEY);
    if (cached) return cached;

    const products = (await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        ...MerchantFieldsService.productMerchantInclude,
        brand: true,
        images: {
          include: { mediaFile: true },

          orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
        },
      },
    })) as unknown as FeedProduct[];

    this.merchantFieldsService.enrichMany(products as any[]);

    const lines = products
      .map((p) => this.buildItem(p))
      .filter((item): item is MetaCatalogItem => item !== null)
      .map((item) => JSON.stringify(item))
      .join('\n');

    await this.cache.set(CACHE_KEY, lines, CACHE_TTL_SECONDS);
    return lines;
  }

  private buildItem(product: FeedProduct): MetaCatalogItem | null {
    const imageUrl = this.pickImage(product);
    if (!imageUrl) {
      this.logger.debug(`Skipping ${product.id}: no image`);
      return null;
    }

    const description =
      product.shortDescription ?? stripHtml(product.description);
    const availability =
      !product.manageStock || product.stock > 0 ? 'in stock' : 'out of stock';

    const item: MetaCatalogItem = {
      id: product.sku ?? product.id,
      title: product.name,
      description,
      link: `${this.siteUrl}/p/${product.slug}`,
      image_link: imageUrl,
      price: `${product.basePrice.toFixed(2)} VND`,
      availability,
      condition: product.condition,
    };

    if (product.salePrice != null) {
      item.sale_price = `${product.salePrice.toFixed(2)} VND`;
    }
    if (product.brand?.name) item.brand = product.brand.name;
    if (product.gtin) item.gtin = product.gtin;
    if (product.mpn) item.mpn = product.mpn;
    if (product.googleCategory?.path)
      item.google_product_category = product.googleCategory.path;
    if (product.color?.name) item.color = product.color.name;
    if (product.material?.name) item.material = product.material.name;

    return item;
  }

  private pickImage(product: FeedProduct): string | null {
    if (!product.images?.length) return null;
    const main = product.images.find((i) => i.isMain);
    return (main ?? product.images[0]).mediaFile.full;
  }
}
