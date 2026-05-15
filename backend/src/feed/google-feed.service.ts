import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantFieldsService } from '../products/merchant-fields.service';
import { FEED_CACHE, type FeedCache } from './feed-cache';

const CACHE_KEY = 'feed:google:v1';
const CACHE_TTL_SECONDS = 3600;
const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;
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

@Injectable()
export class GoogleFeedService {
  private readonly logger = new Logger(GoogleFeedService.name);
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

    const items = products
      .map((p) => this.buildItem(p))
      .filter((item): item is string => item !== null)
      .join('\n');

    const xml = this.envelope(items);
    await this.cache.set(CACHE_KEY, xml, CACHE_TTL_SECONDS);
    return xml;
  }

  private envelope(items: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${escapeXml('Red Figure')}</title>
<link>${this.siteUrl}</link>
<description>${escapeXml('Resin Miniatures by Red Figure')}</description>
${items}
</channel>
</rss>`;
  }

  private buildItem(product: FeedProduct): string | null {
    const imageUrl = this.pickImage(product);
    if (!imageUrl) {

      this.logger.debug(`Skipping ${product.id}: no image`);
      return null;
    }

    const id = product.sku ?? product.id;
    const rawDescription =
      product.shortDescription ?? stripHtml(product.description);
    const description = truncate(rawDescription, DESCRIPTION_MAX);
    const title = truncate(product.name, TITLE_MAX);
    const link = `${this.siteUrl}/p/${product.slug}`;
    const availability =
      !product.manageStock || product.stock > 0 ? 'in stock' : 'out of stock';

    const lines: string[] = [
      '<item>',
      `<g:id>${escapeXml(id)}</g:id>`,
      `<title>${escapeXml(title)}</title>`,
      `<description>${escapeXml(description)}</description>`,
      `<g:link>${escapeXml(link)}</g:link>`,
      `<g:image_link>${escapeXml(imageUrl)}</g:image_link>`,
      `<g:price>${product.basePrice.toFixed(2)} VND</g:price>`,
    ];

    if (product.salePrice != null) {
      lines.push(
        `<g:sale_price>${product.salePrice.toFixed(2)}VND</g:sale_price>`,
      );
    }

    lines.push(`<g:availability>${availability}</g:availability>`);
    lines.push(`<g:condition>${escapeXml(product.condition)}</g:condition>`);

    if (product.brand?.name) {
      lines.push(`<g:brand>${escapeXml(product.brand.name)}</g:brand>`);
    }
    if (product.gtin) {
      lines.push(`<g:gtin>${escapeXml(product.gtin)}</g:gtin>`);
    }
    if (product.mpn) {
      lines.push(`<g:mpn>${escapeXml(product.mpn)}</g:mpn>`);
    }
    if (product.googleCategory?.path) {
      lines.push(
        `<g:google_product_category>${escapeXml(product.googleCategory.path)}</g:google_product_category>`,
      );
    }
    if (product.color?.name) {
      lines.push(`<g:color>${escapeXml(product.color.name)}</g:color>`);
    }
    if (product.material?.name) {
      lines.push(
        `<g:material>${escapeXml(product.material.name)}</g:material>`,
      );
    }

    lines.push('</item>');
    return lines.join('\n');
  }

  private pickImage(product: FeedProduct): string | null {
    if (!product.images?.length) return null;
    const main = product.images.find((i) => i.isMain);
    return (main ?? product.images[0]).mediaFile.full;
  }
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function stripHtml(html: string): string {

  let previous: string;
  let current = html;
  do {
    previous = current;
    current = current.replace(/<[^<>]*>/g, '');
  } while (current !== previous);

  return current.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
