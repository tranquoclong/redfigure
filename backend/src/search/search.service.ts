import { Injectable, Inject, Logger, Optional } from '@nestjs/common';

const DEFAULT_INDEX_NAME = 'products';

export interface ProductDocument {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  salePrice?: number;
  image?: string;
  categoryNames: string[];
  brandName?: string;
  tags: string[];
  attributes: string[];
  isActive: boolean;
}

export interface SearchParams {
  query: string;
  categoryName?: string;
  brandName?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  perPage?: number;
}

export interface SearchResult {
  total: number;
  hits: ProductDocument[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  private readonly indexName: string;

  constructor(
    @Inject('ELASTICSEARCH_CLIENT') private readonly esClient: any,
    @Optional() @Inject('ELASTICSEARCH_INDEX_NAME') indexName?: string,
  ) {
    this.indexName = indexName ?? DEFAULT_INDEX_NAME;
  }

  async ping() {
    const info = await this.esClient.info();
    return { version: info.version?.number, cluster: info.cluster_name };
  }

  async recreateIndex() {
    try {
      const exists = await this.esClient.indices.exists({
        index: this.indexName,
      });
      if (exists) {
        await this.esClient.indices.delete({ index: this.indexName });
        this.logger.log(`Deleted index "${this.indexName}"`);
      }
    } catch (err) {
      this.logger.warn('Error deleting index', err);
    }
    await this.ensureIndex();
  }

  async ensureIndex() {
    const exists = await this.esClient.indices.exists({
      index: this.indexName,
    });
    if (!exists) {
      await this.esClient.indices.create({
        index: this.indexName,
        body: {
          settings: {
            analysis: {
              analyzer: {
                autocomplete_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'autocomplete_filter'],
                },
              },
              filter: {
                autocomplete_filter: {
                  type: 'edge_ngram',
                  min_gram: 2,
                  max_gram: 20,
                },
              },
            },
          },
          mappings: {
            properties: {
              name: {
                type: 'text',
                analyzer: 'autocomplete_analyzer',
                search_analyzer: 'standard',
              },
              slug: { type: 'keyword' },
              description: { type: 'text', analyzer: 'standard' },
              basePrice: { type: 'float' },
              salePrice: { type: 'float' },
              image: { type: 'keyword', index: false },
              categoryNames: { type: 'keyword' },
              brandName: { type: 'keyword' },
              tags: {
                type: 'text',
                analyzer: 'autocomplete_analyzer',
                search_analyzer: 'standard',
              },
              attributes: { type: 'text', analyzer: 'standard' },
              isActive: { type: 'boolean' },
            },
          },
        },
      });
    }
  }

  async indexProduct(doc: ProductDocument) {
    const { id, ...body } = doc;
    await this.esClient.index({
      index: this.indexName,
      id,
      document: body,
    });
  }

  async removeProduct(id: string) {
    try {
      await this.esClient.delete({ index: this.indexName, id });
    } catch (err: any) {
      if (err?.statusCode === 404) return;
      throw err;
    }
  }

  async bulkIndex(docs: ProductDocument[]) {
    if (docs.length === 0) return;

    const operations = docs.flatMap((doc) => {
      const { id, ...body } = doc;
      return [{ index: { _index: this.indexName, _id: id } }, body];
    });

    await this.esClient.bulk({ body: operations });
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const { query, categoryName, brandName, priceMin, priceMax } = params;
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;

    const must: any[] = [];
    const filter: any[] = [{ term: { isActive: true } }];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['name^3', 'description', 'tags^2', 'attributes'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (categoryName) {
      filter.push({ term: { categoryNames: categoryName } });
    }

    if (brandName) {
      filter.push({ term: { brandName } });
    }

    if (priceMin !== undefined || priceMax !== undefined) {
      const range: Record<string, number> = {};
      if (priceMin !== undefined) range.gte = priceMin;
      if (priceMax !== undefined) range.lte = priceMax;
      filter.push({ range: { basePrice: range } });
    }

    const response = await this.esClient.search({
      index: this.indexName,
      body: {
        from: (page - 1) * perPage,
        size: perPage,
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter,
          },
        },
      },
    });

    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total.value;

    const hits: ProductDocument[] = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
    }));

    return { total, hits };
  }

  async autocomplete(query: string, limit = 12): Promise<ProductDocument[]> {
    if (!query || query.trim().length < 2) return [];

    try {
      const response = await this.esClient.search({
        index: this.indexName,
        body: {
          size: limit,
          _source: ['name', 'slug', 'basePrice', 'salePrice', 'image'],
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query,
                    fields: ['name^3', 'tags^2', 'attributes'],
                    fuzziness: 'AUTO',
                  },
                },
              ],
              filter: [{ term: { isActive: true } }],
            },
          },
        },
      });

      return response.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));
    } catch (err) {
      this.logger.error('Autocomplete error', err);
      return [];
    }
  }
}
