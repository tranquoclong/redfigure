
import type { StorefrontProduct as Product } from '@/types/product';

type JsonLd = Record<string, unknown>;

export interface ProductReviewInput {
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ProductSchemaOptions {
  siteUrl: string;
  rating?: { average: number; count: number };
  reviews?: ProductReviewInput[];
}

export function buildProductSchema(
  product: Product,
  options: ProductSchemaOptions,
): JsonLd {
  const { siteUrl, rating, reviews } = options;
  const url = `${siteUrl}/p/${product.slug}`;

  const sortedImages = [...(product.images ?? [])].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    return a.order - b.order;
  });
  const images = sortedImages
    .map((img) => img.mediaFile?.full)
    .filter((u): u is string => !!u && u.startsWith('http'));

  const mainImageUrl = images[0];
  const description = product.shortDescription || product.description;
  const condition = conditionToSchemaUrl(product.condition);
  const variations = product.variations ?? [];
  const isVariable = product.type === 'variable' && variations.length > 0;

  const additionalProperty = (product.attributes ?? []).map((pa) => ({
    '@type': 'PropertyValue',
    name: pa.attributeValue.attribute.name,
    value: pa.attributeValue.value,
  }));

  const aggregateRating =
    rating && rating.count > 0
      ? {
        '@type': 'AggregateRating',
        ratingValue: rating.average.toFixed(1),
        reviewCount: rating.count,
        bestRating: '5',
        worstRating: '1',
      }
      : undefined;

  const reviewList =
    reviews && reviews.length > 0
      ? reviews.map((r) => {
        const body = r.comment?.trim();
        return {
          '@type': 'Review',
          author: {
            '@type': 'Person',
            name: r.authorName?.trim() || 'Ẩn danh',
          },
          datePublished: r.createdAt.slice(0, 10),
          ...(body ? { reviewBody: body } : {}),
          reviewRating: {
            '@type': 'Rating',
            ratingValue: String(r.rating),
            bestRating: '5',
            worstRating: '1',
          },
        };
      })
      : undefined;

  const weight = product.weight
    ? { '@type': 'QuantitativeValue', unitCode: 'GRM', value: product.weight }
    : undefined;

  const brand = product.brand?.name
    ? { '@type': 'Brand', name: product.brand.name }
    : undefined;

  const category = product.googleCategory?.path ?? undefined;

  const webPage: JsonLd = {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: product.name,
    isPartOf: { '@id': `${siteUrl}/#website` },
    ...(product.createdAt ? { datePublished: product.createdAt } : {}),
    ...(product.updatedAt ? { dateModified: product.updatedAt } : {}),
    ...(mainImageUrl ? { primaryImageOfPage: { '@id': mainImageUrl } } : {}),
    inLanguage: 'vi-VN',
  };

  const imageObject = mainImageUrl
    ? {
      '@type': 'ImageObject',
      '@id': mainImageUrl,
      url: mainImageUrl,
      inLanguage: 'vi-VN',
    }
    : undefined;

  if (isVariable) {

    const hasVariant = variations.map((v) => {
      const varPrice = v.salePrice ?? v.price;
      const varInStock =
        v.manageStock === false || (v.availableStock ?? 0) > 0;
      return {
        '@type': 'Product',
        name: `${product.name} - ${v.name}`,
        ...(v.sku ? { sku: v.sku } : {}),
        description,
        ...(v.image ? { image: v.image } : {}),
        offers: {
          '@type': 'Offer',
          price: varPrice.toFixed(2),
          priceCurrency: 'VND',
          availability: varInStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          itemCondition: condition,
          priceValidUntil: '2027-12-31',
          url,
        },
      };
    });

    return {
      '@context': 'https://schema.org',
      '@graph': [
        ...(imageObject ? [imageObject] : []),
        webPage,
        {
          '@type': 'ProductGroup',
          name: product.name,
          description,
          url,
          image: images,
          ...(product.sku ? { sku: product.sku, productGroupID: product.sku } : {}),
          ...(brand ? { brand } : {}),
          ...(category ? { category } : {}),
          ...(weight ? { weight } : {}),
          ...(product.color?.name ? { color: product.color.name } : {}),
          ...(product.material?.name ? { material: product.material.name } : {}),
          ...(additionalProperty.length ? { additionalProperty } : {}),
          ...(aggregateRating ? { aggregateRating } : {}),
          ...(reviewList ? { review: reviewList } : {}),
          mainEntityOfPage: { '@id': `${url}#webpage` },
          hasVariant,
          '@id': `${url}#richSnippet`,
        },
      ],
    };
  }

  const price = product.salePrice ?? product.basePrice;

  const inStock =
    product.manageStock === false || (product.availableStock ?? 0) > 0;

  const offer: JsonLd = {
    '@type': 'Offer',
    priceCurrency: 'VND',
    price: price.toFixed(2),
    availability: inStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    url,
    itemCondition: condition,
    priceValidUntil: product.salePriceEndDate?.slice(0, 10) ?? '2027-12-31',
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...(imageObject ? [imageObject] : []),
      webPage,
      {
        '@type': 'Product',
        name: product.name,
        description,
        url,
        image: images,
        offers: offer,
        ...(brand ? { brand } : {}),
        ...(product.sku ? { sku: product.sku } : {}),
        ...(product.gtin ? { gtin: product.gtin } : {}),
        ...(product.mpn ? { mpn: product.mpn } : {}),
        ...(product.color?.name ? { color: product.color.name } : {}),
        ...(product.material?.name ? { material: product.material.name } : {}),
        ...(category ? { category } : {}),
        ...(weight ? { weight } : {}),
        ...(additionalProperty.length ? { additionalProperty } : {}),
        ...(aggregateRating ? { aggregateRating } : {}),
        ...(reviewList ? { review: reviewList } : {}),
        mainEntityOfPage: { '@id': `${url}#webpage` },
        '@id': `${url}#richSnippet`,
      },
    ],
  };
}

function conditionToSchemaUrl(condition?: string): string {
  switch (condition) {
    case 'refurbished':
      return 'https://schema.org/RefurbishedCondition';
    case 'used':
      return 'https://schema.org/UsedCondition';
    case 'new':
    default:
      return 'https://schema.org/NewCondition';
  }
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface OrganizationSchemaOptions {
  siteUrl: string;
  name: string;
  logoUrl: string;
  description?: string;
  email?: string;
  sameAs?: string[];
}

export function buildOrganizationSchema(
  options: OrganizationSchemaOptions,
): JsonLd {
  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${options.siteUrl}/#organization`,
    name: options.name,
    url: options.siteUrl,
    logo: {
      '@type': 'ImageObject',
      '@id': `${options.siteUrl}/#logo`,
      url: options.logoUrl,
      contentUrl: options.logoUrl,
      caption: options.name,
      inLanguage: 'vi-VN',
    },
  };
  if (options.description) schema.description = options.description;
  if (options.email) schema.email = options.email;
  if (options.sameAs?.length) schema.sameAs = options.sameAs;
  return schema;
}

export interface WebSiteSchemaOptions {
  siteUrl: string;
  name: string;
}

export function buildWebSiteSchema(options: WebSiteSchemaOptions): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${options.siteUrl}/#website`,
    name: options.name,
    url: options.siteUrl,
    publisher: { '@id': `${options.siteUrl}/#organization` },
    inLanguage: 'vi-VN',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${options.siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface CollectionPageSchemaOptions {
  siteUrl: string;
  name: string;
  description: string;
  url: string;
  image?: string;
}

export function buildCollectionPageSchema(
  options: CollectionPageSchemaOptions,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: options.name,
    description: options.description,
    url: options.url,
    isPartOf: { '@id': `${options.siteUrl}/#website` },
    inLanguage: 'vi-VN',
    ...(options.image ? { image: options.image } : {}),
  };
}

export interface BlogPostingSchemaOptions {
  siteUrl: string;
  title: string;
  description: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
}

export function buildBlogPostingSchema(
  options: BlogPostingSchemaOptions,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: options.title,
    description: options.description,
    url: options.url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': options.url },
    isPartOf: { '@id': `${options.siteUrl}/#website` },
    inLanguage: 'vi-VN',
    ...(options.image ? { image: options.image } : {}),
    ...(options.datePublished ? { datePublished: options.datePublished } : {}),
    ...(options.dateModified ? { dateModified: options.dateModified } : {}),
    ...(options.authorName
      ? { author: { '@type': 'Person', name: options.authorName } }
      : { author: { '@id': `${options.siteUrl}/#organization` } }),
    publisher: { '@id': `${options.siteUrl}/#organization` },
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqPageSchema(items: FaqItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
