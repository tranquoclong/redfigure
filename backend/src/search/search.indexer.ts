import { Injectable, Logger } from '@nestjs/common';
import { SearchService, ProductDocument } from './search.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchIndexer {
  private readonly logger = new Logger(SearchIndexer.name);

  constructor(
    private searchService: SearchService,
    private prisma: PrismaService,
  ) { }

  private toDocument(product: any): ProductDocument {
    const mainImage =
      product.images?.find((i: any) => i.isMain) ?? product.images?.[0];

    const indexPrice = product.displayPrice ?? product.basePrice ?? 0;
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: indexPrice,
      salePrice: product.salePrice ?? undefined,
      image: mainImage?.mediaFile?.thumb ?? undefined,
      categoryNames:
        product.productCategories
          ?.map((pc: any) => pc.category?.name)
          .filter(Boolean) ?? [],
      brandName: product.brand?.name,
      tags: product.tags?.map((t: any) => t.name) ?? [],
      attributes:
        product.attributes
          ?.map((pa: any) => pa.attributeValue?.value)
          .filter(Boolean) ?? [],
      isActive: product.isActive,
    };
  }

  async indexProductById(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        productCategories: { include: { category: true } },
        brand: true,
        tags: true,
        images: {
          include: { mediaFile: true },
          where: { isMain: true },
          take: 1,
        },
        attributes: { include: { attributeValue: true } },
      },
    });

    if (!product || !product.isActive) {
      await this.searchService.removeProduct(productId);
      return;
    }

    await this.searchService.indexProduct(this.toDocument(product));
  }

  async reindexAll() {
    this.logger.log('Starting full reindex...');

    await this.searchService.recreateIndex();

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        productCategories: { include: { category: true } },
        brand: true,
        tags: true,
        images: {
          include: { mediaFile: true },
          where: { isMain: true },
          take: 1,
        },
        attributes: { include: { attributeValue: true } },
      },
    });

    const docs = products.map((p) => this.toDocument(p));
    await this.searchService.bulkIndex(docs);

    this.logger.log(`Reindexed ${docs.length} products`);
  }
}
