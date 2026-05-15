import { Test, TestingModule } from '@nestjs/testing';
import { SearchIndexer } from './search.indexer';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SearchIndexer', () => {
  let indexer: SearchIndexer;
  let searchService: SearchService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchIndexer,
        {
          provide: SearchService,
          useValue: {
            indexProduct: jest.fn(),
            removeProduct: jest.fn(),
            bulkIndex: jest.fn(),
            recreateIndex: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            product: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    indexer = module.get<SearchIndexer>(SearchIndexer);
    searchService = module.get<SearchService>(SearchService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const mockProduct = {
    id: 'prod1',
    name: 'Warrior',
    slug: 'warrior',
    description: 'A mighty warrior',
    basePrice: 49.9,
    salePrice: null,
    isActive: true,
    category: { name: 'Fantasy' },
    productCategories: [{ category: { name: 'Fantasy' } }],
    brand: { name: 'Arsenal Craft' },
    tags: [{ name: 'rpg' }, { name: 'fantasy' }],
    images: [],
    attributes: [{ attributeValue: { value: 'Espada' } }],
  };

  describe('indexProductById', () => {
    it('should fetch product from DB and index it', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      await indexer.indexProductById('prod1');

      expect(searchService.indexProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'prod1',
          name: 'Warrior',
          slug: 'warrior',
          basePrice: 49.9,
          categoryNames: ['Fantasy'],
          brandName: 'Arsenal Craft',
          tags: ['rpg', 'fantasy'],
          attributes: ['Espada'],
          isActive: true,
        }),
      );
    });

    it('should remove from index if product not found', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await indexer.indexProductById('nonexistent');

      expect(searchService.removeProduct).toHaveBeenCalledWith('nonexistent');
    });

    it('should remove from index if product is inactive', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await indexer.indexProductById('prod1');

      expect(searchService.removeProduct).toHaveBeenCalledWith('prod1');
    });
  });

  describe('reindexAll', () => {
    it('should bulk index all active products', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        mockProduct,
        { ...mockProduct, id: 'prod2', name: 'Mage' },
      ]);

      await indexer.reindexAll();

      expect(searchService.bulkIndex).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'prod1', name: 'Warrior' }),
          expect.objectContaining({ id: 'prod2', name: 'Mage' }),
        ]),
      );
    });
  });
});
