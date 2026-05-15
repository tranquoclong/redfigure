import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeBlocksCaches } from '../site-config/home-blocks.types';
import { MerchantFieldsService } from './merchant-fields.service';
import slugify from 'slug';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_DETAIL_CACHE_KEY_PREFIX = 'cache:product:slug:';
const PRODUCT_DETAIL_CACHE_KEY_SUFFIX = ':v1';
const PRODUCT_DETAIL_CACHE_TTL_SEC = 600;

function productDetailCacheKey(slug: string): string {
  return `${PRODUCT_DETAIL_CACHE_KEY_PREFIX}${slug}${PRODUCT_DETAIL_CACHE_KEY_SUFFIX}`;
}

function computeAvailableStock(
  manageStock: unknown,
  stock: unknown,
  reservedStock: unknown,
): number | null {
  if (manageStock === false) return null;
  const s = typeof stock === 'number' ? stock : Number(stock) || 0;
  const r =
    typeof reservedStock === 'number'
      ? reservedStock
      : Number(reservedStock) || 0;
  return Math.max(0, s - r);
}

function sanitizeOneProductShape<T extends Record<string, any>>(p: T): T {

  const { stock, reservedStock, manageStock, ...rest } = p;
  return {
    ...rest,
    manageStock,
    availableStock: computeAvailableStock(manageStock, stock, reservedStock),
  } as unknown as T;
}

function sanitizeProductForPublic<T extends Record<string, any> | null>(
  product: T,
): T {
  if (!product) return product;
  const sanitized: any = sanitizeOneProductShape(product as any);

  if (Array.isArray(sanitized.variations)) {
    sanitized.variations = sanitized.variations.map((v: any) =>
      sanitizeOneProductShape(v),
    );
  }

  if (Array.isArray(sanitized.bundleComponents)) {
    sanitized.bundleComponents = sanitized.bundleComponents.map((bc: any) => {
      const out: any = { ...bc };
      if (out.childProduct) {
        out.childProduct = sanitizeOneProductShape(out.childProduct);
        if (Array.isArray(out.childProduct.variations)) {
          out.childProduct.variations = out.childProduct.variations.map(
            (v: any) => sanitizeOneProductShape(v),
          );
        }
      }
      if (out.childVariation) {
        out.childVariation = sanitizeOneProductShape(out.childVariation);
      }
      return out;
    });
  }

  return sanitized;
}

function buildProductCategoryRows(
  productId: string,
  categoryIds: string[],
  primaryCategoryId: string | undefined,
): Array<{ productId: string; categoryId: string; isPrimary: boolean }> {
  if (primaryCategoryId && !categoryIds.includes(primaryCategoryId)) {
    throw new BadRequestException(
      'primaryCategoryId must be one of categoryIds',
    );
  }
  const primary = primaryCategoryId ?? categoryIds[0];
  return categoryIds.map((catId) => ({
    productId,
    categoryId: catId,
    isPrimary: catId === primary,
  }));
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private categoriesService: CategoriesService,
    private merchantFieldsService: MerchantFieldsService,
    private redis: RedisService,
  ) { }

  private async invalidateProductDetailCache(
    ...slugs: Array<string | null | undefined>
  ): Promise<void> {
    const unique = Array.from(
      new Set(slugs.filter((s): s is string => Boolean(s))),
    );
    for (const slug of unique) {
      try {
        await this.redis.del(productDetailCacheKey(slug));
      } catch (err) {
        this.logger.warn(
          `Error invalidating product cache, slug=${slug}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async syncVariationNames<
    T extends { name: string; attributeValueId?: string | null },
  >(variations: T[]): Promise<T[]> {
    const linkedIds = Array.from(
      new Set(
        variations
          .map((v) => v.attributeValueId)
          .filter((id): id is string => !!id),
      ),
    );
    if (linkedIds.length === 0) return variations;

    const values = await this.prisma.attributeValue.findMany({
      where: { id: { in: linkedIds }, deletedAt: null },
      select: { id: true, value: true },
    });
    const byId = new Map(values.map((av) => [av.id, av.value]));

    return variations.map((v) => {
      if (!v.attributeValueId) return v;
      if (!byId.has(v.attributeValueId)) {

        throw new BadRequestException(
          `AttributeValue ${v.attributeValueId} is invalid or deleted`,
        );
      }
      return { ...v, name: byId.get(v.attributeValueId)! };
    });
  }

  private async resolveUniqueSlug(
    name: string,
    explicitSlug?: string,
  ): Promise<string> {
    if (explicitSlug) {
      const existing = await this.prisma.product.findUnique({
        where: { slug: explicitSlug },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Product slug already exists');
      }
      return explicitSlug;
    }

    const base = slugify(name, { lower: true });
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const existing = await this.prisma.product.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }

    throw new ConflictException(
      'Could not generate unique slug after 100 attempts',
    );
  }

  private async assertVariableCanPublish(opts: {
    type: string;
    isDraft: boolean;
    variations?: Array<{ name?: string; price?: number }>;
    loadCurrentVariations?: () => Promise<
      Array<{ name: string; price: number }>
    >;
  }): Promise<void> {
    if (opts.type !== 'variable' || opts.isDraft) return;

    let variations = opts.variations;
    if (variations === undefined && opts.loadCurrentVariations) {
      variations = await opts.loadCurrentVariations();
    }

    if (!variations || variations.length === 0) {
      throw new BadRequestException(
        'Variable product needs at least 1 variation to be published. Save as draft while configuring.',
      );
    }

    const invalid = variations.find((v) => !(Number(v.price) > 0));
    if (invalid) {
      throw new BadRequestException(
        `All variations must have a price > 0 to be published. "${invalid.name ?? 'unnamed variation'}" is with price ${invalid.price ?? 0}. Save as draft while adjusting prices.`,
      );
    }
  }

  async create(dto: CreateProductDto) {
    const slug = await this.resolveUniqueSlug(dto.name, dto.slug);

    const {
      tagIds,
      categoryIds,
      primaryCategoryId,
      attributeValueIds,
      images,
      variations,
      bundleComponents,
      brandId,
      colorId,
      materialId,
      googleCategoryId,
      scaleRuleSetId,

      dropboxFolderPath: _dropboxFolderPath,
      renameDropboxFolder: _renameDropboxFolder,
      ...productData
    } = dto;

    if (categoryIds?.length && primaryCategoryId) {
      if (!categoryIds.includes(primaryCategoryId)) {
        throw new BadRequestException(
          'primaryCategoryId must be one of categoryIds',
        );
      }
    }

    if (productData.type === 'bundle') {
      if (!bundleComponents?.length) {
        throw new BadRequestException(
          'Bundle products must have at least one component',
        );
      }

      productData.manageStock = false;
    }

    await this.assertVariableCanPublish({
      type: productData.type ?? 'simple',
      isDraft: productData.isDraft === true,
      variations,
    });

    const basePrice = productData.basePrice ?? 0;
    const description = productData.description ?? '';

    const isVariable = productData.type === 'variable';
    const initialDisplayPrice = isVariable
      ? 0
      : (productData.salePrice ?? basePrice);

    const createData: Record<string, unknown> = {
      ...productData,
      slug,
      basePrice,
      description,
      displayPrice: initialDisplayPrice,
      brandId: brandId || undefined,
      colorId: colorId || undefined,
      materialId: materialId || undefined,
      googleCategoryId: googleCategoryId || undefined,
      scaleRuleSetId: scaleRuleSetId || undefined,
      ...(tagIds?.length && {
        tags: { connect: tagIds.map((id: string) => ({ id })) },
      }),
      ...(attributeValueIds?.length && {
        attributes: {
          create: Array.from(new Set(attributeValueIds)).map(
            (avId: string) => ({
              attributeValueId: avId,
            }),
          ),
        },
      }),
      ...(images?.length && {
        images: {
          create: images.map((img) => ({
            mediaFileId: img.mediaFileId,
            isMain: img.isMain,
            order: img.order,
          })),
        },
      }),
    };

    const tryCreate = async (slugToUse: string) =>
      this.prisma.product.create({

        data: {
          ...createData,
          slug: slugToUse,
        } as Prisma.ProductCreateInput,
        include: {
          productCategories: { include: { category: true } },
          brand: true,
          tags: true,
          images: {
            include: {
              mediaFile: {
                include: {

                  captionPreset: {
                    select: { id: true, name: true, text: true },
                  },
                },
              },
            },

            orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
          },
          attributes: {
            where: {
              attributeValue: {
                deletedAt: null,
                attribute: { deletedAt: null },
              },
            },
            include: { attributeValue: { include: { attribute: true } } },
          },
        },
      });

    const MAX_RETRIES = 3;
    let product;
    let currentSlug = slug;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        product = await tryCreate(currentSlug);
        break;
      } catch (err: unknown) {
        const e = err as { code?: string; meta?: { target?: string[] } };
        const isSlugConflict =
          e.code === 'P2002' && e.meta?.target?.includes('slug');
        if (!isSlugConflict) throw err;
        if (dto.slug)
          throw new ConflictException('Product slug already exists');
        if (attempt === MAX_RETRIES) {
          throw new ConflictException(
            'System busy: could not generate unique slug. Try again.',
          );
        }

        currentSlug = await this.resolveUniqueSlug(dto.name, undefined);
      }
    }
    if (!product) {

      throw new ConflictException('Could not create product');
    }

    if (categoryIds?.length) {
      await this.prisma.productCategory.createMany({
        data: buildProductCategoryRows(
          product.id,
          categoryIds,
          primaryCategoryId,
        ),
      });
    }

    if (variations?.length) {

      const variationAttrIds = Array.from(
        new Set(
          variations
            .map((v) => v.attributeValueId)
            .filter((id): id is string => !!id),
        ),
      );
      if (variationAttrIds.length > 0) {
        const validAttrs = await this.prisma.attributeValue.findMany({
          where: { id: { in: variationAttrIds }, deletedAt: null },
          select: { id: true },
        });
        const validIds = new Set(validAttrs.map((a) => a.id));
        for (const avId of variationAttrIds) {
          if (!validIds.has(avId)) {
            throw new BadRequestException(
              `AttributeValue ${avId} does not exist or was removed`,
            );
          }
        }

        const alreadySelected = new Set(attributeValueIds ?? []);
        const toAutoAdd = variationAttrIds.filter(
          (avId) => !alreadySelected.has(avId),
        );
        if (toAutoAdd.length > 0) {
          await this.prisma.productAttribute.createMany({
            data: toAutoAdd.map((avId) => ({
              productId: product.id,
              attributeValueId: avId,
            })),
            skipDuplicates: true,
          });
        }
      }

      const syncedVariations = await this.syncVariationNames(variations);

      await this.prisma.productVariation.createMany({
        data: syncedVariations.map((v) => ({
          productId: product.id,
          name: v.name,
          sku: v.sku ?? '',
          gtin: v.gtin,
          price: v.price,
          salePrice: v.salePrice,
          manageStock: v.manageStock ?? true,
          stock: v.stock ?? 0,
          weight: v.weight,
          width: v.width,
          height: v.height,
          length: v.length,
          image: v.image,
          attributeValueId: v.attributeValueId,
        })),
      });

      const needImages = syncedVariations.filter(
        (v) => v.images && v.images.length > 0,
      );
      if (needImages.length > 0) {
        const created = await this.prisma.productVariation.findMany({
          where: {
            productId: product.id,
            name: { in: needImages.map((v) => v.name) },
            deletedAt: null,
          },
          select: { id: true, name: true },
        });
        const byName = new Map(created.map((cv) => [cv.name, cv.id]));
        const imageRows = needImages.flatMap((v) => {
          const variationId = byName.get(v.name);
          if (!variationId) return [];
          return (v.images ?? []).map((img) => ({
            variationId,
            mediaFileId: img.mediaFileId,
            isMain: img.isMain,
            order: img.order,
          }));
        });
        if (imageRows.length > 0) {
          await this.prisma.productVariationImage.createMany({
            data: imageRows,
          });
        }
      }

      if (isVariable) {
        const prices = variations
          .map((v) => v.salePrice ?? v.price)
          .filter((p): p is number => typeof p === 'number' && p > 0);
        const displayPrice = prices.length ? Math.min(...prices) : 0;
        await this.prisma.product.update({
          where: { id: product.id },
          data: { displayPrice },
        });
      }
    }

    if (bundleComponents?.length && productData.type === 'bundle') {

      if (bundleComponents.some((c) => c.childProductId === product.id)) {
        throw new BadRequestException(
          'Bundle cannot contain itself as a component',
        );
      }

      await this.prisma.bundleComponent.createMany({
        data: bundleComponents.map((c, i) => ({
          parentProductId: product.id,
          childProductId: c.childProductId,
          childVariationId: c.childVariationId,
          quantity: c.quantity,
          sortOrder: c.sortOrder ?? i,
        })),
      });

      await this.recalculateBundlePrice(product.id);
    }

    await invalidateHomeBlocksCaches(this.redis);

    return product;
  }

  async findById(id: string, opts: { sanitize?: boolean } = {}) {
    const sanitize = opts.sanitize !== false;
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        ...MerchantFieldsService.productMerchantInclude,
        brand: true,
        tags: true,
        images: {
          include: {
            mediaFile: {
              include: {
                captionPreset: { select: { id: true, name: true, text: true } },
              },
            },
          },

          orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
        },
        variations: {
          where: { deletedAt: null },
          include: {
            attributeValue: {
              where: { deletedAt: null, attribute: { deletedAt: null } },
              include: { attribute: true },
            },
            images: {
              include: {
                mediaFile: {
                  include: {

                    captionPreset: {
                      select: { id: true, name: true, text: true },
                    },
                  },
                },
              },

              orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
            },
          },
        },
        attributes: {
          where: {
            attributeValue: {
              deletedAt: null,
              attribute: { deletedAt: null },
            },
          },
          include: { attributeValue: { include: { attribute: true } } },
        },
        relatedProducts: true,
        bundleComponents: {
          include: {
            childProduct: {
              include: {
                images: {
                  include: {
                    mediaFile: {
                      include: {

                        captionPreset: {
                          select: { id: true, name: true, text: true },
                        },
                      },
                    },
                  },
                  where: { isMain: true },
                  take: 1,
                },
                variations: { where: { deletedAt: null } },
              },
            },
            childVariation: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    if (sanitize && (!product.isActive || product.isDraft)) {
      throw new NotFoundException('Product not found');
    }
    const enriched = this.merchantFieldsService.enrich(product as any);
    return sanitize ? sanitizeProductForPublic(enriched as any) : enriched;
  }

  async findBySlug(slug: string, opts: { sanitize?: boolean } = {}) {

    const sanitize = opts.sanitize !== false;

    const cacheKey = productDetailCacheKey(slug);
    const cached = await this.redis
      .getJson<unknown>(cacheKey)
      .catch(() => null);
    if (cached)
      return sanitize ? sanitizeProductForPublic(cached as any) : cached;

    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true, isDraft: false },
      include: {
        ...MerchantFieldsService.productMerchantInclude,
        brand: true,
        tags: true,
        images: {
          include: {
            mediaFile: {
              include: {
                captionPreset: { select: { id: true, name: true, text: true } },
              },
            },
          },

          orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
        },
        variations: {
          where: { deletedAt: null },
          include: {
            attributeValue: {
              where: { deletedAt: null, attribute: { deletedAt: null } },
              include: { attribute: true },
            },
            images: {
              include: {
                mediaFile: {
                  include: {

                    captionPreset: {
                      select: { id: true, name: true, text: true },
                    },
                  },
                },
              },

              orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
            },
          },
        },
        attributes: {
          where: {
            attributeValue: {
              deletedAt: null,
              attribute: { deletedAt: null },
            },
          },
          include: { attributeValue: { include: { attribute: true } } },
        },
        relatedProducts: true,
        bundleComponents: {
          include: {
            childProduct: {
              include: {
                images: {
                  include: {
                    mediaFile: {
                      include: {

                        captionPreset: {
                          select: { id: true, name: true, text: true },
                        },
                      },
                    },
                  },
                  where: { isMain: true },
                  take: 1,
                },
                variations: { where: { deletedAt: null } },
              },
            },
            childVariation: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    const enriched = this.merchantFieldsService.enrich(product as any);

    if (
      enriched &&
      typeof enriched === 'object' &&
      'brand' in enriched &&
      enriched.brand
    ) {
      const brandId = (enriched.brand as { id?: string }).id;
      if (brandId) {
        const productsCount = await this.prisma.product.count({
          where: { brandId, isActive: true, isDraft: false },
        });
        (enriched.brand as Record<string, unknown>).productsCount =
          productsCount;
      }
    }

    void this.redis
      .setJson(cacheKey, enriched, PRODUCT_DETAIL_CACHE_TTL_SEC)
      .catch((err) =>
        this.logger.warn(
          `Error writing product cache, slug=${slug}: ${(err as Error).message}`,
        ),
      );

    return sanitize ? sanitizeProductForPublic(enriched as any) : enriched;
  }

  async findAll(params: {
    page: number;
    perPage: number;
    categoryId?: string;
    brandId?: string;
    tagId?: string;
    search?: string;
    attributeValueIds?: string[];
    priceMin?: number;
    priceMax?: number;
    featured?: boolean;
    onSale?: boolean;
    sort?: 'alphabetical' | 'price-asc' | 'price-desc' | 'recent' | 'sold';
    admin?: boolean;
    type?: 'simple' | 'variable' | 'bundle';
    stockStatus?: 'in_stock' | 'out_of_stock' | 'low_stock';
  }) {
    const {
      page,
      perPage,
      categoryId,
      brandId,
      tagId,
      search,
      attributeValueIds,
      priceMin,
      priceMax,
      featured,
      onSale,
      sort,
      admin,
      type,
      stockStatus,
    } = params;
    const skip = (page - 1) * perPage;

    const where: Record<string, any> = admin
      ? {}
      : { isActive: true, isDraft: false };
    if (featured) where.featured = true;
    if (type && ['simple', 'variable', 'bundle'].includes(type)) {
      where.type = type;
    }
    if (categoryId) {
      const descendantIds =
        await this.categoriesService.getDescendantIds(categoryId);
      where.productCategories = {
        some: { categoryId: { in: [categoryId, ...descendantIds] } },
      };
    }
    if (brandId) where.brandId = brandId;
    if (tagId) where.tags = { some: { id: tagId } };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
        {
          attributes: {
            some: {
              attributeValue: {
                value: { contains: search, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }
    if (attributeValueIds?.length) {
      where.attributes = {
        some: { attributeValueId: { in: attributeValueIds } },
      };
    }

    const andGroups: any[] = [];

    if (priceMin !== undefined || priceMax !== undefined) {

      const basePriceFilter: any = { basePrice: { gt: 0 } };
      if (priceMin !== undefined) basePriceFilter.basePrice.gte = priceMin;
      if (priceMax !== undefined) basePriceFilter.basePrice.lte = priceMax;

      const variationPriceFilter: any = {
        type: 'variable',
        variations: {
          some: {
            deletedAt: null,
            OR: [
              priceMax !== undefined
                ? {
                  salePrice: {
                    not: null,
                    lte: priceMax,
                    ...(priceMin !== undefined ? { gte: priceMin } : {}),
                  },
                }
                : null,
              {
                salePrice: null,
                price: {
                  ...(priceMin !== undefined ? { gte: priceMin } : {}),
                  ...(priceMax !== undefined ? { lte: priceMax } : {}),
                },
              },
            ].filter(Boolean),
          },
        },
      };

      andGroups.push({ OR: [basePriceFilter, variationPriceFilter] });
    }

    if (onSale) {
      const now = new Date();
      const dateActive = {
        AND: [
          {
            OR: [
              { salePriceStartDate: null },
              { salePriceStartDate: { lte: now } },
            ],
          },
          {
            OR: [
              { salePriceEndDate: null },
              { salePriceEndDate: { gte: now } },
            ],
          },
        ],
      };

      andGroups.push({
        OR: [

          { salePrice: { not: null }, ...dateActive },

          {
            type: 'variable',
            variations: {
              some: { salePrice: { not: null }, deletedAt: null },
            },
          },
        ],
      });
    }

    if (stockStatus === 'in_stock') {
      andGroups.push({
        OR: [{ manageStock: false }, { manageStock: true, stock: { gt: 0 } }],
      });
    } else if (stockStatus === 'out_of_stock') {
      andGroups.push({ manageStock: true, stock: { lte: 0 } });
    } else if (stockStatus === 'low_stock') {
      andGroups.push({ manageStock: true, stock: { gt: 0, lte: 5 } });
    }

    if (andGroups.length) where.AND = andGroups;

    const [data, total, filters] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          ...MerchantFieldsService.productMerchantInclude,
          brand: true,
          images: {
            include: {
              mediaFile: {
                include: {

                  captionPreset: {
                    select: { id: true, name: true, text: true },
                  },
                },
              },
            },
            where: { isMain: true },
            take: 1,
          },
          variations: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              price: true,
              salePrice: true,
              manageStock: true,
              stock: true,
            },
          },
        },
        skip,
        take: perPage,
        orderBy: this.resolveOrderBy(sort, admin),
      }),
      this.prisma.product.count({ where }),
      this.buildDynamicFilters(where),
    ]);

    const enriched = this.merchantFieldsService.enrichMany(data as any[]);

    const sanitized = admin
      ? enriched
      : enriched.map((p: any) => sanitizeProductForPublic(p));
    return {
      data: sanitized,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage),
      },
      filters,
    };
  }

  private resolveOrderBy(
    sort:
      | 'alphabetical'
      | 'price-asc'
      | 'price-desc'
      | 'recent'
      | 'sold'
      | undefined,
    admin?: boolean,
  ): Array<Record<string, 'asc' | 'desc'>> {

    const featuredFirst = { featured: 'desc' as const };

    const effectiveSort = sort ?? (admin ? 'recent' : 'alphabetical');
    switch (effectiveSort) {
      case 'price-asc':
        return [featuredFirst, { displayPrice: 'asc' }];
      case 'price-desc':
        return [featuredFirst, { displayPrice: 'desc' }];
      case 'recent':
        return [featuredFirst, { createdAt: 'desc' }];
      case 'sold':
        return [featuredFirst, { salesCount: 'desc' }];
      case 'alphabetical':
      default:
        return [featuredFirst, { name: 'asc' }];
    }
  }

  async recomputeDisplayPrice(productId: string): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variations: { where: { deletedAt: null } } },
    });
    if (!product) return 0;

    let displayPrice = 0;
    if (product.type === 'variable') {
      const prices = (product.variations ?? [])
        .map(
          (v: { price: number; salePrice: number | null }) =>
            v.salePrice ?? v.price,
        )
        .filter((p: number) => p > 0);
      displayPrice = prices.length ? Math.min(...prices) : 0;
    } else {
      displayPrice = product.salePrice ?? product.basePrice;
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { displayPrice },
    });

    return displayPrice;
  }

  private async buildDynamicFilters(where: Record<string, any>) {

    const productIds = await this.prisma.product.findMany({
      where,
      select: { id: true },
    });
    const ids = productIds.map((p) => p.id);

    if (ids.length === 0) {
      return { brands: [], attributes: [], priceRange: { min: 0, max: 0 } };
    }

    const brands = await this.prisma.brand.findMany({
      where: { products: { some: { id: { in: ids } } } },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: { where: { id: { in: ids } } } } },
      },
      orderBy: { name: 'asc' },
    });

    const filterAttributes = await this.prisma.attribute.findMany({
      where: { isFilter: true, deletedAt: null },
      include: {
        values: {
          where: {
            deletedAt: null,
            productAttributes: { some: { productId: { in: ids } } },
          },
          select: {
            id: true,
            value: true,
            slug: true,
            _count: {
              select: {
                productAttributes: { where: { productId: { in: ids } } },
              },
            },
          },
          orderBy: { value: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const priceAgg = await this.prisma.product.aggregate({
      where: { id: { in: ids } },
      _min: { basePrice: true },
      _max: { basePrice: true },
    });

    return {
      brands: brands.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        count: b._count.products,
      })),
      attributes: filterAttributes
        .filter((a) => a.values.length > 0)
        .map((a) => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          values: a.values.map((v) => ({
            id: v.id,
            value: v.value,
            slug: v.slug,
            count: v._count.productAttributes,
          })),
        })),
      priceRange: {
        min: priceAgg._min.basePrice ?? 0,
        max: priceAgg._max.basePrice ?? 0,
      },
    };
  }

  async update(id: string, dto: UpdateProductDto, adminUserId?: string) {
    const {
      tagIds,
      categoryIds,
      primaryCategoryId,
      attributeValueIds,
      images,
      variations,
      bundleComponents,
      brandId,
      colorId,
      materialId,
      googleCategoryId,
      scaleRuleSetId,
      dropboxFolderPath: _dpPath,
      renameDropboxFolder: _dpRename,
      ...updateData
    } = dto as UpdateProductDto & {
      dropboxFolderPath?: string;
      renameDropboxFolder?: boolean;
    };

    if (
      categoryIds !== undefined &&
      categoryIds.length > 0 &&
      primaryCategoryId &&
      !categoryIds.includes(primaryCategoryId)
    ) {
      throw new BadRequestException(
        'primaryCategoryId must be one of categoryIds',
      );
    }

    const current = await this.prisma.product.findUnique({
      where: { id },
      select: { type: true, isDraft: true, slug: true },
    });
    const oldSlug = current?.slug ?? null;
    if (current) {
      const effectiveType = (updateData.type ?? current.type) as string;
      const effectiveIsDraft =
        updateData.isDraft !== undefined
          ? updateData.isDraft === true
          : current.isDraft;

      await this.assertVariableCanPublish({
        type: effectiveType,
        isDraft: effectiveIsDraft,
        variations,
        loadCurrentVariations: async () => {
          const rows = await this.prisma.productVariation.findMany({
            where: { productId: id, deletedAt: null },
            select: { name: true, price: true },
          });
          return rows.map((r) => ({
            name: r.name,
            price: Number(r.price),
          }));
        },
      });
    }

    const data: Record<string, any> = { ...updateData };

    if (brandId !== undefined) {
      data.brand = brandId
        ? { connect: { id: brandId } }
        : { disconnect: true };
    }
    if (colorId !== undefined) {
      data.color = colorId
        ? { connect: { id: colorId } }
        : { disconnect: true };
    }
    if (materialId !== undefined) {
      data.material = materialId
        ? { connect: { id: materialId } }
        : { disconnect: true };
    }
    if (googleCategoryId !== undefined) {
      data.googleCategory = googleCategoryId
        ? { connect: { id: googleCategoryId } }
        : { disconnect: true };
    }
    if (scaleRuleSetId !== undefined) {
      data.scaleRuleSet = scaleRuleSetId
        ? { connect: { id: scaleRuleSetId } }
        : { disconnect: true };
    }
    if (dto.name && !dto.slug) {
      data.slug = slugify(dto.name, { lower: true });
    }

    if (tagIds !== undefined) {
      data.tags = {
        set: tagIds.map((id) => ({ id })),
      };
    }

    if (categoryIds !== undefined) {
      await this.prisma.productCategory.deleteMany({
        where: { productId: id },
      });
      if (categoryIds.length > 0) {
        await this.prisma.productCategory.createMany({
          data: buildProductCategoryRows(id, categoryIds, primaryCategoryId),
        });
      }
    }

    if (attributeValueIds !== undefined) {
      await this.prisma.productAttribute.deleteMany({
        where: { productId: id },
      });
      if (attributeValueIds.length > 0) {
        await this.prisma.productAttribute.createMany({
          data: Array.from(new Set(attributeValueIds)).map((avId) => ({
            productId: id,
            attributeValueId: avId,
          })),
        });
      }
    }

    if (images !== undefined) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      if (images.length > 0) {
        await this.prisma.productImage.createMany({
          data: images.map((img) => ({
            productId: id,
            mediaFileId: img.mediaFileId,
            isMain: img.isMain,
            order: img.order,
          })),
        });
      }
    }

    if (dto.stock !== undefined && adminUserId) {
      const current = await this.prisma.product.findUnique({ where: { id } });
      if (current && current.stock !== dto.stock) {
        const delta = dto.stock - current.stock;
        await this.prisma.stockAuditLog.create({
          data: {
            productId: id,
            quantityBefore: current.stock,
            quantityAfter: dto.stock,
            delta,
            reason: 'ADMIN_ADJUSTMENT',
            referenceId: adminUserId,
            note: dto.stockAdjustmentNote ?? null,
          },
        });
      }
    }

    if (variations !== undefined) {

      const variationAttrIds = Array.from(
        new Set(
          variations
            .map((v) => v.attributeValueId)
            .filter((id): id is string => !!id),
        ),
      );
      if (variationAttrIds.length > 0) {
        const validAttrs = await this.prisma.attributeValue.findMany({
          where: { id: { in: variationAttrIds }, deletedAt: null },
          select: { id: true },
        });
        const validIds = new Set(validAttrs.map((a) => a.id));
        for (const avId of variationAttrIds) {
          if (!validIds.has(avId)) {
            throw new BadRequestException(
              `AttributeValue ${avId} does not exist or was removed`,
            );
          }
        }

        const effective =
          attributeValueIds !== undefined
            ? new Set(attributeValueIds)
            : new Set(
              (
                await this.prisma.productAttribute.findMany({
                  where: { productId: id },
                  select: { attributeValueId: true },
                })
              ).map((pa) => pa.attributeValueId),
            );
        const toAutoAdd = variationAttrIds.filter(
          (avId) => !effective.has(avId),
        );
        if (toAutoAdd.length > 0) {
          await this.prisma.productAttribute.createMany({
            data: toAutoAdd.map((avId) => ({
              productId: id,
              attributeValueId: avId,
            })),
            skipDuplicates: true,
          });
        }
      }

      const existingVariations = await this.prisma.productVariation.findMany({
        where: { productId: id, deletedAt: null },
      });

      const syncedVariations = await this.syncVariationNames(variations);

      const incomingIds = syncedVariations
        .filter((v) => v.id)
        .map((v) => v.id!);

      const existingIds = new Set(existingVariations.map((ev) => ev.id));
      for (const incomingId of incomingIds) {
        if (!existingIds.has(incomingId)) {
          throw new BadRequestException(
            `Variation ${incomingId} does not belong to product ${id}`,
          );
        }
      }

      const toDelete = existingVariations.filter(
        (ev) => !incomingIds.includes(ev.id),
      );
      const toUpdate = syncedVariations.filter((v) => v.id);
      const toCreate = syncedVariations.filter((v) => !v.id);

      if (toDelete.length > 0) {
        await this.prisma.productVariation.updateMany({
          where: { id: { in: toDelete.map((v) => v.id) } },
          data: { deletedAt: new Date() },
        });
      }

      for (const v of toUpdate) {
        const existing = existingVariations.find((ev) => ev.id === v.id);
        const newStock = v.stock ?? 0;

        await this.prisma.productVariation.update({
          where: { id: v.id },
          data: {
            name: v.name,
            sku: v.sku ?? '',
            gtin: v.gtin,
            price: v.price,
            salePrice: v.salePrice,
            manageStock: v.manageStock ?? true,
            stock: newStock,
            weight: v.weight,
            width: v.width,
            height: v.height,
            length: v.length,
            image: v.image,
            attributeValueId: v.attributeValueId,
          },
        });

        if (v.images !== undefined) {
          const imgs = v.images;
          await this.prisma.$transaction([
            this.prisma.productVariationImage.deleteMany({
              where: { variationId: v.id! },
            }),
            ...(imgs.length > 0
              ? [
                this.prisma.productVariationImage.createMany({
                  data: imgs.map((img) => ({
                    variationId: v.id!,
                    mediaFileId: img.mediaFileId,
                    isMain: img.isMain,
                    order: img.order,
                  })),
                }),
              ]
              : []),
          ]);
        }

        if (existing && existing.stock !== newStock && adminUserId) {
          await this.prisma.stockAuditLog.create({
            data: {
              productId: id,
              variationId: v.id,
              quantityBefore: existing.stock,
              quantityAfter: newStock,
              delta: newStock - existing.stock,
              reason: 'ADMIN_ADJUSTMENT',
              referenceId: adminUserId,
              note: dto.stockAdjustmentNote ?? null,
            },
          });
        }
      }

      if (toCreate.length > 0) {
        await this.prisma.productVariation.createMany({
          data: toCreate.map((v) => ({
            productId: id,
            name: v.name,
            sku: v.sku ?? '',
            gtin: v.gtin,
            price: v.price,
            salePrice: v.salePrice,
            manageStock: v.manageStock ?? true,
            stock: v.stock ?? 0,
            weight: v.weight,
            width: v.width,
            height: v.height,
            length: v.length,
            image: v.image,
            attributeValueId: v.attributeValueId,
          })),
        });

        const needImages = toCreate.filter(
          (v) => v.images && v.images.length > 0,
        );
        if (needImages.length > 0) {
          const created = await this.prisma.productVariation.findMany({
            where: {
              productId: id,
              name: { in: needImages.map((v) => v.name) },
              deletedAt: null,
            },
            select: { id: true, name: true },
          });
          const byName = new Map(created.map((cv) => [cv.name, cv.id]));
          const imageRows = needImages.flatMap((v) => {
            const variationId = byName.get(v.name);
            if (!variationId) return [];
            return (v.images ?? []).map((img) => ({
              variationId,
              mediaFileId: img.mediaFileId,
              isMain: img.isMain,
              order: img.order,
            }));
          });
          if (imageRows.length > 0) {
            await this.prisma.productVariationImage.createMany({
              data: imageRows,
            });
          }
        }
      }
    }

    if (bundleComponents !== undefined) {
      await this.prisma.bundleComponent.deleteMany({
        where: { parentProductId: id },
      });
      if (bundleComponents.length > 0) {
        await this.prisma.bundleComponent.createMany({
          data: bundleComponents.map((c, i) => ({
            parentProductId: id,
            childProductId: c.childProductId,
            childVariationId: c.childVariationId,
            quantity: c.quantity,
            sortOrder: c.sortOrder ?? i,
          })),
        });
      }
      await this.recalculateBundlePrice(id);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data,
      include: {
        productCategories: { include: { category: true } },
        brand: true,
        tags: true,
        images: {
          include: {
            mediaFile: {
              include: {
                captionPreset: { select: { id: true, name: true, text: true } },
              },
            },
          },

          orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
        },
        variations: {
          where: { deletedAt: null },
          include: {
            attributeValue: {
              where: { deletedAt: null, attribute: { deletedAt: null } },
              include: { attribute: true },
            },
            images: {
              include: {
                mediaFile: {
                  include: {

                    captionPreset: {
                      select: { id: true, name: true, text: true },
                    },
                  },
                },
              },

              orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
            },
          },
        },
        attributes: {
          where: {
            attributeValue: {
              deletedAt: null,
              attribute: { deletedAt: null },
            },
          },
          include: { attributeValue: { include: { attribute: true } } },
        },
      },
    });

    if (updated.type !== 'bundle') {
      await this.recomputeDisplayPrice(id);
    }

    await this.invalidateProductDetailCache(oldSlug, updated.slug);

    await invalidateHomeBlocksCaches(this.redis);

    return updated;
  }

  async recalculateBundlePrice(productId: string): Promise<number> {
    const components = await this.prisma.bundleComponent.findMany({
      where: { parentProductId: productId },
      include: { childProduct: true, childVariation: true },
    });

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    const discount = product?.bundleDiscount ?? 0;

    const sum = components.reduce(
      (
        total: number,
        c: { childVariation: any; childProduct: any; quantity: number },
      ) => {
        const price = c.childVariation
          ? (c.childVariation.salePrice ?? c.childVariation.price)
          : (c.childProduct.salePrice ?? c.childProduct.basePrice);

        return total + price * c.quantity;
      },
      0,
    );

    const bundlePrice = Math.round(sum * (1 - discount / 100) * 100) / 100;
    const displayPrice = product?.salePrice ?? bundlePrice;

    await this.prisma.product.update({
      where: { id: productId },
      data: { basePrice: bundlePrice, displayPrice },
    });

    return bundlePrice;
  }

  async remove(id: string) {

    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!existing) throw new NotFoundException('Product not found');

    try {
      const deleted = await this.prisma.product.delete({ where: { id } });
      await this.invalidateProductDetailCache(existing.slug);
      return deleted;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Product not found');
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Could not delete: there are linked records blocking removal',
        );
      }
      throw err;
    }
  }

  async findStockAudit(
    productId: string,
    params: { page: number; perPage: number },
  ) {
    const { page, perPage } = params;
    const where = { productId };

    const [logs, total, variations] = await Promise.all([
      this.prisma.stockAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.stockAuditLog.count({ where }),

      this.prisma.productVariation.findMany({
        where: { productId },
        select: { id: true, name: true },
      }),
    ]);

    const orderIds = logs
      .filter((l) => l.reason !== 'ADMIN_ADJUSTMENT' && l.referenceId)
      .map((l) => l.referenceId!)
      .filter((v, i, a) => a.indexOf(v) === i);
    const adminIds = logs
      .filter((l) => l.reason === 'ADMIN_ADJUSTMENT' && l.referenceId)
      .map((l) => l.referenceId!)
      .filter((v, i, a) => a.indexOf(v) === i);

    const [orders, admins] = await Promise.all([
      orderIds.length
        ? this.prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, number: true },
        })
        : Promise.resolve([]),
      adminIds.length
        ? this.prisma.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true, email: true },
        })
        : Promise.resolve([]),
    ]);

    const orderMap = new Map(orders.map((o) => [o.id, o.number]));
    const adminMap = new Map(
      admins.map((a) => [a.id, { name: a.name, email: a.email }]),
    );
    const variationMap = new Map(variations.map((v) => [v.id, v.name]));

    const enriched = logs.map((l) => ({
      ...l,
      variationName: l.variationId
        ? (variationMap.get(l.variationId) ?? null)
        : null,
      reference:
        l.reason === 'ADMIN_ADJUSTMENT' && l.referenceId
          ? {
            type: 'admin' as const,
            admin: adminMap.get(l.referenceId) ?? null,
          }
          : l.referenceId
            ? {
              type: 'order' as const,
              orderNumber: orderMap.get(l.referenceId) ?? null,
              orderId: l.referenceId,
            }
            : null,
    }));

    return {
      data: enriched,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async resolveExtraDays(productId: string): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { tags: true },
    });

    if (!product) return 0;

    if (product.extraDays != null) return product.extraDays;

    const tagDays = product.tags
      .map((t) => t.extraDays)
      .filter((d): d is number => d != null);
    if (tagDays.length > 0) return Math.max(...tagDays);

    const productCats = await this.prisma.productCategory.findMany({
      where: { productId },
      include: { category: true },
    });

    const catDays: number[] = [];
    for (const pc of productCats) {
      const inherited = await this.categoriesService.resolveInheritedField(
        pc.categoryId,
        'extraDays',
      );
      if (inherited != null) catDays.push(inherited as number);
    }
    if (catDays.length > 0) return Math.max(...catDays);

    return 0;
  }

  async resolveShippingData(
    productId: string,
    variationId?: string,
  ): Promise<{
    weight: number | null;
    width: number | null;
    height: number | null;
    length: number | null;
    price: number;
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variations: { where: { deletedAt: null } } },
    });

    if (!product) throw new NotFoundException('Product not found');

    if (variationId) {
      const variation = product.variations.find(
        (v: { id: string }) => v.id === variationId,
      );
      if (!variation) {
        throw new NotFoundException('Variation not found in this product');
      }

      return {
        weight: variation.weight ?? product.weight,
        width: variation.width ?? product.width,
        height: variation.height ?? product.height,
        length: variation.length ?? product.length,
        price: variation.salePrice ?? variation.price,
      };
    }

    return {
      weight: product.weight,
      width: product.width,
      height: product.height,
      length: product.length,
      price: product.salePrice ?? product.basePrice,
    };
  }
}
