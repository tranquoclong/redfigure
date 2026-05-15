import type { Product } from '@/types/product';
import { buildProductSchema, type ProductSchemaOptions } from './schemas';
import { JsonLdScript } from './JsonLdScript';

interface ProductSchemaProps {
  product: Product;
  siteUrl: string;
  rating?: ProductSchemaOptions['rating'];
  reviews?: ProductSchemaOptions['reviews'];
}

export function ProductSchema({
  product,
  siteUrl,
  rating,
  reviews,
}: ProductSchemaProps) {
  const data = buildProductSchema(product, { siteUrl, rating, reviews });
  return <JsonLdScript data={data} />;
}
