export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  content?: string;
  type?: string;
  basePrice: number;
  salePrice?: number;

  bundleDiscount?: number;
  bundleComponents?: BundleComponent[];
  sku?: string;
  gtin?: string;
  mpn?: string;
  condition?: string;

  colorId?: string;
  color?: Color;
  materialId?: string;
  material?: Material;
  googleCategoryId?: string;
  googleCategory?: GoogleCategory;
  salePriceStartDate?: string;
  salePriceEndDate?: string;
  manageStock?: boolean;

  availableStock?: number | null;
  stock: number;
  reservedStock: number;
  weight?: number;
  width?: number;
  height?: number;
  length?: number;
  extraDays?: number;
  isDraft?: boolean;
  isActive: boolean;
  featured: boolean;
  categoryId?: string;
  category?: Category;
  categories?: Category[];
  productCategories?: Array<{ id: string; categoryId: string; category: Category }>;
  brandId?: string;
  brand?: Brand;
  tags: Tag[];
  images: ProductImage[];
  variations: ProductVariation[];
  attributes?: ProductAttribute[];
  relatedProducts?: RelatedProduct[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  url?: string;
  altText?: string;
  order: number;
  isMain: boolean;
  mediaFileId?: string;
  mediaFile?: MediaFile;
}

export interface CaptionPreset {
  id: string;
  name: string;
  text: string;
}

export interface MediaFile {
  id: string;
  filename: string;
  thumb: string;
  card: string;
  gallery: string;
  full: string;
  alt?: string;
  title?: string;
  description?: string;

  caption?: string | null;
  captionPreset?: CaptionPreset | null;
  captionPresetId?: string | null;
  width?: number;
  height?: number;
}

export function resolveCaption(
  mf?: {
    caption?: string | null;
    captionPreset?: { text: string } | null;
  } | null,
): string | null {
  if (!mf) return null;
  return mf.captionPreset?.text ?? mf.caption ?? null;
}

export interface ProductVariation {
  id: string;
  name: string;
  sku: string;
  gtin?: string;
  price: number;
  salePrice?: number;
  manageStock?: boolean;

  availableStock?: number | null;
  stock: number;
  reservedStock: number;
  image?: string;
  images?: ProductVariationImage[];
  scale: Scale;
  attributeValueId?: string | null;
  attributeValue?: {
    id: string;
    value: string;
    attribute: { id: string; name: string };
  } | null;
}

export interface ProductVariationImage {
  id: string;
  mediaFileId: string;
  mediaFile?: MediaFile;
  order: number;
  isMain: boolean;
}

export interface Color {
  id: string;
  name: string;
  slug: string;
}

export interface Material {
  id: string;
  name: string;
  slug: string;
}

export interface GoogleCategory {
  id: string;
  name: string;
  path: string;
  parentId?: string | null;
}

export interface BundleComponent {
  id: string;
  childProductId: string;
  childProduct: Product;
  childVariationId?: string;
  childVariation?: ProductVariation;
  quantity: number;
  sortOrder: number;
}

export interface ProductAttribute {
  id: string;
  attributeValueId: string;
  attributeValue: {
    id: string;
    value: string;
    attribute: {
      id: string;
      name: string;
    };
  };
}

export interface RelatedProduct {
  id: string;
  type: string;
  targetId: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  children?: Category[];
  extraDays?: number;
  _count?: { products: number };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
  extraDays?: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  skuPrefix?: string;
  renameFolderDefault?: boolean;
  skuCounter?: { counter: number };
  scaleRuleSetId?: string | null;
  noScales?: boolean;
}

export interface Scale {
  id: string;
  name: string;
  code: string;
  baseSize: number;
  multiplier: number;
}

export type StorefrontProductVariation = Omit<
  ProductVariation,
  'stock' | 'reservedStock'
> & {

  availableStock?: number | null;
};

export type StorefrontProduct = Omit<
  Product,
  'stock' | 'reservedStock' | 'variations' | 'bundleComponents'
> & {
  availableStock?: number | null;
  variations: StorefrontProductVariation[];
  bundleComponents?: StorefrontBundleComponent[];
};

export interface StorefrontBundleComponent
  extends Omit<BundleComponent, 'childProduct' | 'childVariation'> {
  childProduct: StorefrontProduct;
  childVariation?: StorefrontProductVariation;
}
