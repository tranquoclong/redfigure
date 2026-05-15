import { Injectable } from '@nestjs/common';

interface ColorEntity {
  id: string;
  name: string;
  slug: string;
}

interface MaterialEntity {
  id: string;
  name: string;
  slug: string;
}

interface GoogleCategoryEntity {
  id: string;
  name: string;
  path: string;
}

interface CategoryWithChain {
  id: string;
  parentId: string | null;
  parent: CategoryWithChain | null;
  color: ColorEntity | null;
  material: MaterialEntity | null;
  googleCategory: GoogleCategoryEntity | null;
}

interface ProductWithMerchantSources {
  color: ColorEntity | null;
  material: MaterialEntity | null;
  googleCategory: GoogleCategoryEntity | null;
  productCategories?: Array<{
    isPrimary: boolean;
    category: CategoryWithChain;
  }>;
}

export interface ResolvedMerchantFields {
  color: ColorEntity | null;
  material: MaterialEntity | null;
  googleCategory: GoogleCategoryEntity | null;
}

@Injectable()
export class MerchantFieldsService {

  static readonly productMerchantInclude = {
    color: true,
    material: true,
    googleCategory: true,
    productCategories: {
      include: {
        category: {
          include: {
            color: true,
            material: true,
            googleCategory: true,
            parent: {
              include: {
                color: true,
                material: true,
                googleCategory: true,
                parent: {
                  include: {
                    color: true,
                    material: true,
                    googleCategory: true,
                    parent: {
                      include: {
                        color: true,
                        material: true,
                        googleCategory: true,
                        parent: {
                          include: {
                            color: true,
                            material: true,
                            googleCategory: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  } as const;

  resolve(product: ProductWithMerchantSources): ResolvedMerchantFields {
    const primary = this.findPrimaryCategory(product);
    return {
      color: product.color ?? this.walkChain(primary, 'color'),
      material: product.material ?? this.walkChain(primary, 'material'),
      googleCategory:
        product.googleCategory ?? this.walkChain(primary, 'googleCategory'),
    };
  }

  enrich<T extends ProductWithMerchantSources>(product: T): T {
    const resolved = this.resolve(product);
    (product as ProductWithMerchantSources).color = resolved.color;
    (product as ProductWithMerchantSources).material = resolved.material;
    (product as ProductWithMerchantSources).googleCategory =
      resolved.googleCategory;
    return product;
  }

  enrichMany<T extends ProductWithMerchantSources>(products: T[]): T[] {
    for (const p of products) this.enrich(p);
    return products;
  }

  private findPrimaryCategory(
    product: ProductWithMerchantSources,
  ): CategoryWithChain | null {
    const primary = product.productCategories?.find((pc) => pc.isPrimary);
    return primary?.category ?? null;
  }

  private walkChain<K extends 'color' | 'material' | 'googleCategory'>(
    start: CategoryWithChain | null,
    field: K,
  ): CategoryWithChain[K] {
    let current: CategoryWithChain | null = start;
    while (current) {
      if (current[field]) return current[field];
      current = current.parent ?? null;
    }
    return null;
  }
}
