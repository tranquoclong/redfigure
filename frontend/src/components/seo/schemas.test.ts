import { describe, it, expect } from 'vitest';
import {
  buildProductSchema,
  buildBreadcrumbSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
} from './schemas';
import type { StorefrontProduct as Product } from '@/types/product';

const SITE_URL = 'https://redfigure.com';

function getProductNode(schema: Record<string, unknown>): Record<string, unknown> {
  const graph = schema['@graph'] as Array<Record<string, unknown>>;
  const node = graph.find(
    (n) => n['@type'] === 'Product' || n['@type'] === 'ProductGroup',
  );
  if (!node) throw new Error('Product node not found in @graph');
  return node;
}

const baseProduct: Product = {
  id: 'p1',
  name: 'Elven Warrior',
  slug: 'guerreira-elfica',
  description: 'Detailed miniature of an elven warrior',
  shortDescription: 'Warrior in 32mm resin',
  basePrice: 49.9,
  isActive: true,
  featured: false,
  tags: [],
  images: [
    {
      id: 'img1',
      order: 0,
      isMain: true,
      mediaFile: {
        id: 'mf1',
        filename: 'main.jpg',
        thumb: 'https://cdn.example.com/img1-thumb.webp',
        card: 'https://cdn.example.com/img1-card.webp',
        gallery: 'https://cdn.example.com/img1-gallery.webp',
        full: 'https://cdn.example.com/img1-full.webp',
      },
    },
    {
      id: 'img2',
      order: 1,
      isMain: false,
      mediaFile: {
        id: 'mf2',
        filename: 'extra.jpg',
        thumb: 't',
        card: 'c',
        gallery: 'g',
        full: 'https://cdn.example.com/img2-full.webp',
      },
    },
  ],
  variations: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('buildProductSchema', () => {
  it('should return a valid Product JSON-LD with required fields', () => {
    const schema = buildProductSchema(baseProduct, { siteUrl: SITE_URL });

    expect(schema['@context']).toBe('https://schema.org');
    const product = getProductNode(schema);
    expect(product['@type']).toBe('Product');
    expect(product.name).toBe('Elven Warrior');

    expect(product.description).toBe('Warrior in 32mm resin');
    expect(product.image).toEqual([
      'https://cdn.example.com/img1-full.webp',
      'https://cdn.example.com/img2-full.webp',
    ]);
    expect(product.url).toBe(`${SITE_URL}/p/guerreira-elfica`);
  });

  it('should serialize to valid JSON', () => {
    const schema = buildProductSchema(baseProduct, { siteUrl: SITE_URL });
    expect(() => JSON.stringify(schema)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(schema));
    expect(getProductNode(parsed)['@type']).toBe('Product');
  });

  it('should include brand when present', () => {
    const product = {
      ...baseProduct,
      brand: { id: 'b1', name: 'Arsenal Craft', slug: 'arsenal-craft' },
    };
    const schema = buildProductSchema(product, { siteUrl: SITE_URL });
    expect(getProductNode(schema).brand).toEqual({
      '@type': 'Brand',
      name: 'Arsenal Craft',
    });
  });

  it('should include sku, gtin, mpn when present', () => {
    const product = {
      ...baseProduct,
      sku: 'SKU-001',
      gtin: '7890123456789',
      mpn: 'MPN-XYZ',
    };
    const schema = buildProductSchema(product, { siteUrl: SITE_URL });
    const node = getProductNode(schema);
    expect(node.sku).toBe('SKU-001');
    expect(node.gtin).toBe('7890123456789');
    expect(node.mpn).toBe('MPN-XYZ');
  });

  it('should include color/material/googleCategory from FK relations', () => {
    const product = {
      ...baseProduct,
      color: { id: 'c1', name: 'Gray', slug: 'gray' },
      material: { id: 'm1', name: 'Resin', slug: 'resina' },
      googleCategory: {
        id: '1253',
        name: 'Action figures',
        path: 'Toys > Figures > Action figures',
      },
    };
    const schema = buildProductSchema(product, { siteUrl: SITE_URL });
    const node = getProductNode(schema);
    expect(node.color).toBe('Gray');
    expect(node.material).toBe('Resin');
    expect(node.category).toBe('Toys > Figures > Action figures');
  });

  it('should build offer with VND currency and InStock when availableStock > 0', () => {
    const product = { ...baseProduct, availableStock: 10, manageStock: true };
    const schema = buildProductSchema(product, { siteUrl: SITE_URL });
    const offer = getProductNode(schema).offers as Record<string, unknown>;
    expect(offer['@type']).toBe('Offer');
    expect(offer.priceCurrency).toBe('VND');
    expect(offer.price).toBe('49.90');
    expect(offer.availability).toBe('https://schema.org/InStock');
    expect(offer.url).toBe(`${SITE_URL}/p/guerreira-elfica`);
  });

  it('should use salePrice when available', () => {
    const product = { ...baseProduct, salePrice: 39.9 };
    const schema = buildProductSchema(product, { siteUrl: SITE_URL });
    const offer = getProductNode(schema).offers as Record<string, unknown>;
    expect(offer.price).toBe('39.90');
  });

  it('should mark OutOfStock when availableStock = 0 and manageStock', () => {
    const product = { ...baseProduct, availableStock: 0, manageStock: true };
    const schema = buildProductSchema(product, { siteUrl: SITE_URL });
    const offer = getProductNode(schema).offers as Record<string, unknown>;
    expect(offer.availability).toBe('https://schema.org/OutOfStock');
  });

  it('should include priceValidUntil from salePriceEndDate', () => {
    const product = {
      ...baseProduct,
      salePrice: 39.9,
      salePriceEndDate: '2026-12-31T23:59:59Z',
    };
    const schema = buildProductSchema(product, { siteUrl: SITE_URL });
    const offer = getProductNode(schema).offers as Record<string, unknown>;
    expect(offer.priceValidUntil).toBe('2026-12-31');
  });

  it('should include aggregateRating when reviews exist', () => {
    const schema = buildProductSchema(baseProduct, {
      siteUrl: SITE_URL,
      rating: { average: 4.5, count: 12 },
    });
    expect(getProductNode(schema).aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: 12,
      bestRating: '5',
      worstRating: '1',
    });
  });

  it('should NOT include aggregateRating when count is 0', () => {
    const schema = buildProductSchema(baseProduct, {
      siteUrl: SITE_URL,
      rating: { average: 0, count: 0 },
    });
    expect(getProductNode(schema).aggregateRating).toBeUndefined();
  });

  it('should include review[] array when reviews are provided', () => {
    const schema = buildProductSchema(baseProduct, {
      siteUrl: SITE_URL,
      reviews: [
        {
          authorName: 'John Doe',
          rating: 5,
          comment: 'Excellent product, incredible details!',
          createdAt: '2026-03-01T10:00:00Z',
        },
        {
          authorName: 'Maria Santos',
          rating: 4,
          comment: 'Beautiful, I recommend it.',
          createdAt: '2026-03-05T12:00:00Z',
        },
      ],
    });
    const node = getProductNode(schema);
    const reviews = node.review as Array<Record<string, unknown>>;
    expect(Array.isArray(reviews)).toBe(true);
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toEqual({
      '@type': 'Review',
      author: { '@type': 'Person', name: 'John Doe' },
      datePublished: '2026-03-01',
      reviewBody: 'Excellent product, incredible details!',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: '5',
        bestRating: '5',
        worstRating: '1',
      },
    });
  });

  it('should NOT include review when reviews array is empty', () => {
    const schema = buildProductSchema(baseProduct, {
      siteUrl: SITE_URL,
      reviews: [],
    });
    expect(getProductNode(schema).review).toBeUndefined();
  });

  it('should fall back to "Anonymous" when authorName is empty', () => {
    const schema = buildProductSchema(baseProduct, {
      siteUrl: SITE_URL,
      reviews: [
        {
          authorName: '',
          rating: 5,
          comment: 'Great',
          createdAt: '2026-03-01T00:00:00Z',
        },
      ],
    });
    const node = getProductNode(schema);
    const reviews = node.review as Array<Record<string, unknown>>;
    expect((reviews[0].author as Record<string, unknown>).name).toBe('Anonymous');
  });

  it('should omit reviewBody when comment is null or empty', () => {
    const schema = buildProductSchema(baseProduct, {
      siteUrl: SITE_URL,
      reviews: [
        {
          authorName: 'Carlos',
          rating: 4,
          comment: null,
          createdAt: '2026-03-01T00:00:00Z',
        },
      ],
    });
    const node = getProductNode(schema);
    const reviews = node.review as Array<Record<string, unknown>>;
    expect(reviews[0].reviewBody).toBeUndefined();
    expect(reviews[0].reviewRating).toBeDefined();
  });
});

describe('buildBreadcrumbSchema', () => {
  it('should return a valid BreadcrumbList JSON-LD', () => {
    const schema = buildBreadcrumbSchema([
      { name: 'Home', url: SITE_URL },
      { name: 'Products', url: `${SITE_URL}/products` },
      { name: 'Warrior', url: `${SITE_URL}/p/guerreira` },
    ]);

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(Array.isArray(schema.itemListElement)).toBe(true);
    const items = schema.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: SITE_URL,
    });
    expect(items[2].position).toBe(3);
  });
});

describe('buildOrganizationSchema', () => {
  it('should return a valid Organization JSON-LD', () => {
    const schema = buildOrganizationSchema({
      siteUrl: SITE_URL,
      name: 'RedFigure',
      logoUrl: `${SITE_URL}/logo.png`,
    });

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Organization');
    expect(schema.name).toBe('RedFigure');
    expect(schema.url).toBe(SITE_URL);

    const logo = schema.logo as Record<string, unknown>;
    expect(logo['@type']).toBe('ImageObject');
    expect(logo.url).toBe(`${SITE_URL}/logo.png`);
  });
});

describe('buildWebSiteSchema', () => {
  it('should return a valid WebSite JSON-LD with SearchAction', () => {
    const schema = buildWebSiteSchema({
      siteUrl: SITE_URL,
      name: 'RedFigure',
    });

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('WebSite');
    expect(schema.name).toBe('RedFigure');
    expect(schema.url).toBe(SITE_URL);

    const action = schema.potentialAction as Record<string, unknown>;
    expect(action['@type']).toBe('SearchAction');
    expect(action.target).toEqual({
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    });
    expect(action['query-input']).toBe('required name=search_term_string');
  });
});
