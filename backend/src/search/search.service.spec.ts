import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let mockEsClient: any;

  beforeEach(async () => {
    mockEsClient = {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
      },
      index: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
      bulk: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: 'ELASTICSEARCH_CLIENT', useValue: mockEsClient },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  describe('indexProduct', () => {
    it('should index a product document in Elasticsearch', async () => {
      mockEsClient.index.mockResolvedValue({ result: 'created' });

      await service.indexProduct({
        id: 'prod1',
        name: 'Warrior Miniature',
        description: 'A mighty warrior',
        basePrice: 49.9,
        categoryNames: ['Fantasy'],
        brandName: 'Arsenal Craft',
        tags: ['rpg', 'fantasy'],
        isActive: true,
      });

      expect(mockEsClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod1',
        document: expect.objectContaining({
          name: 'Warrior Miniature',
          basePrice: 49.9,
          categoryNames: ['Fantasy'],
        }),
      });
    });
  });

  describe('removeProduct', () => {
    it('should delete a product from the index', async () => {
      mockEsClient.delete.mockResolvedValue({ result: 'deleted' });

      await service.removeProduct('prod1');

      expect(mockEsClient.delete).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod1',
      });
    });

    it('should not throw if product not found in index', async () => {
      mockEsClient.delete.mockRejectedValue({ statusCode: 404 });

      await expect(service.removeProduct('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('search', () => {
    it('should return products matching a text query', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: 'prod1',
              _score: 1.5,
              _source: {
                name: 'Warrior Miniature',
                description: 'A mighty warrior',
                basePrice: 49.9,
                categoryNames: ['Fantasy'],
                brandName: 'Arsenal Craft',
                tags: ['rpg'],
                isActive: true,
              },
            },
          ],
        },
      });

      const result = await service.search({ query: 'warrior' });

      expect(result.total).toBe(1);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].name).toBe('Warrior Miniature');
    });

    it('should filter by category', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.search({ query: 'warrior', categoryName: 'Sci-Fi' });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { term: { categoryNames: 'Sci-Fi' } },
                ]),
              }),
            }),
          }),
        }),
      );
    });

    it('should filter by price range', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.search({ query: 'miniature', priceMin: 20, priceMax: 80 });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { range: { basePrice: { gte: 20, lte: 80 } } },
                ]),
              }),
            }),
          }),
        }),
      );
    });

    it('should paginate results', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { total: { value: 50 }, hits: [] },
      });

      await service.search({ query: 'miniature', page: 3, perPage: 10 });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            from: 20,
            size: 10,
          }),
        }),
      );
    });

    it('should only return active products', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.search({ query: 'test' });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([{ term: { isActive: true } }]),
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('autocomplete', () => {
    it('should return up to 12 product summaries matching query', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: {
          hits: [
            {
              _id: 'p1',
              _source: {
                name: 'Dragon Warrior',
                slug: 'dragon-warrior',
                basePrice: 49.9,
                salePrice: null,
                image: '/img.webp',
              },
            },
            {
              _id: 'p2',
              _source: {
                name: 'Dragon Knight',
                slug: 'dragon-knight',
                basePrice: 59.9,
                salePrice: 49.9,
                image: '/img2.webp',
              },
            },
          ],
        },
      });

      const result = await service.autocomplete('dragon');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Dragon Warrior');
      expect(result[0].slug).toBe('dragon-warrior');
      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            size: 12,
            _source: ['name', 'slug', 'basePrice', 'salePrice', 'image'],
          }),
        }),
      );
    });

    it('should return empty array for short queries', async () => {
      const result = await service.autocomplete('a');
      expect(result).toEqual([]);
      expect(mockEsClient.search).not.toHaveBeenCalled();
    });

    it('should return empty array on ES error', async () => {
      mockEsClient.search.mockRejectedValue(new Error('ES down'));

      const result = await service.autocomplete('dragon');
      expect(result).toEqual([]);
    });
  });

  describe('ELASTICSEARCH_INDEX_PREFIX (multi-env isolation)', () => {
    async function createServiceWithIndexName(indexName: string) {
      const esClient = {
        indices: { exists: jest.fn(), create: jest.fn(), delete: jest.fn() },
        index: jest.fn().mockResolvedValue({ result: 'created' }),
        delete: jest.fn().mockResolvedValue({ result: 'deleted' }),
        search: jest.fn().mockResolvedValue({
          hits: { total: { value: 0 }, hits: [] },
        }),
        bulk: jest.fn(),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SearchService,
          { provide: 'ELASTICSEARCH_CLIENT', useValue: esClient },
          { provide: 'ELASTICSEARCH_INDEX_NAME', useValue: indexName },
        ],
      }).compile();
      const svc = module.get<SearchService>(SearchService);
      return { svc, esClient };
    }

    it('with empty prefix (prod default) uses "products" — backward compat', async () => {
      const { svc, esClient } = await createServiceWithIndexName('products');
      await svc.indexProduct({
        id: 'p1',
        name: 'X',
        description: '',
        basePrice: 1,
        categoryNames: [],
        tags: [],
        isActive: true,
      });
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'products' }),
      );
    });

    it('with prefix "stg_" uses "stg_products" in indexProduct', async () => {
      const { svc, esClient } =
        await createServiceWithIndexName('stg_products');
      await svc.indexProduct({
        id: 'p1',
        name: 'X',
        description: '',
        basePrice: 1,
        categoryNames: [],
        tags: [],
        isActive: true,
      });
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'stg_products' }),
      );
    });

    it('prefix isolates removeProduct and search in the same ES cluster', async () => {
      const { svc, esClient } =
        await createServiceWithIndexName('stg_products');
      await svc.removeProduct('p1');
      expect(esClient.delete).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'stg_products' }),
      );
      await svc.search({ query: 'x' });
      expect(esClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'stg_products' }),
      );
    });
  });
});
