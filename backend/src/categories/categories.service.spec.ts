import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            getJson: jest.fn().mockResolvedValue(null),
            setJson: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
  });

  describe('create', () => {
    it('should create category with auto-generated slug', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.category.create as jest.Mock).mockResolvedValue({
        id: 'cat1',
        name: 'Fantasy Miniatures',
        slug: 'fantasy-miniatures',
        parentId: null,
        isActive: true,
      });

      const result = await service.create({
        name: 'Fantasy Miniatures',
        description: 'Fantasy miniatures',
      });

      expect(result.slug).toBe('fantasy-miniatures');
    });

    it('should create nested category with parentId', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.category.create as jest.Mock).mockResolvedValue({
        id: 'cat2',
        name: 'Elves',
        slug: 'elves',
        parentId: 'cat1',
      });

      const result = await service.create({
        name: 'Elves',
        parentId: 'cat1',
      });

      expect(result.parentId).toBe('cat1');
    });

    it('should throw ConflictException for duplicate slug', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
        slug: 'fantasy-miniatures',
      });

      await expect(
        service.create({ name: 'Fantasy Miniatures' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return categories hierarchy (root with children)', async () => {
      const categories = [
        {
          id: 'cat1',
          name: 'Fantasy',
          slug: 'fantasy',
          children: [{ id: 'cat2', name: 'Elves', slug: 'elves' }],
        },
      ];

      (prisma.category.findMany as jest.Mock).mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
    });

    it('cache HIT — returns from Redis without touching Prisma', async () => {
      const cached = [
        { id: 'cat1', name: 'Cached', slug: 'cached', children: [] },
      ];
      (redis.getJson as jest.Mock).mockResolvedValue(cached);

      const result = await service.findAll();

      expect(result).toEqual(cached);
      expect(prisma.category.findMany).not.toHaveBeenCalled();
    });

    it('cache MISS — fetch DB and save with TTL 600s', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      const fresh = [{ id: 'cat1', name: 'Fresh', children: [] }];
      (prisma.category.findMany as jest.Mock).mockResolvedValue(fresh);

      const result = await service.findAll();

      expect(result).toEqual(fresh);
      expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
      expect(redis.setJson).toHaveBeenCalledWith(
        'cache:categories:tree:v1',
        fresh,
        600,
      );
    });

    it('redis getJson fail → degrades to DB without propagating error', async () => {
      (redis.getJson as jest.Mock).mockRejectedValue(new Error('Redis down'));
      const fresh = [{ id: 'cat1', children: [] }];
      (prisma.category.findMany as jest.Mock).mockResolvedValue(fresh);

      const result = await service.findAll();

      expect(result).toEqual(fresh);
    });

    it('redis setJson fail → response ok (write best-effort)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (redis.setJson as jest.Mock).mockRejectedValue(new Error('Redis down'));
      const fresh = [{ id: 'cat1', children: [] }];
      (prisma.category.findMany as jest.Mock).mockResolvedValue(fresh);

      await expect(service.findAll()).resolves.toEqual(fresh);
    });

    it('cache stampede: 50 concurrent calls in miss → 1 DB query (Gemini R1 🟡)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      const fresh = [{ id: 'cat1', children: [] }];

      (prisma.category.findMany as jest.Mock).mockImplementation(
        () => new Promise((r) => setTimeout(() => r(fresh), 20)),
      );

      const requests = Array.from({ length: 50 }, () => service.findAll());
      const results = await Promise.all(requests);

      expect(
        results.every(
          (r) => r === fresh || JSON.stringify(r) === JSON.stringify(fresh),
        ),
      ).toBe(true);
      expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache invalidation in mutations', () => {
    it('create invalidates cache', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.category.create as jest.Mock).mockResolvedValue({
        id: 'new',
        slug: 'new',
      });

      await service.create({ name: 'New' });

      expect(redis.del).toHaveBeenCalledWith('cache:categories:tree:v1');
    });

    it('update invalidates cache', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.category.update as jest.Mock).mockResolvedValue({ id: 'cat1' });

      await service.update('cat1', { name: 'Updated' });

      expect(redis.del).toHaveBeenCalledWith('cache:categories:tree:v1');
    });

    it('remove invalidates cache', async () => {
      (prisma.category.update as jest.Mock).mockResolvedValue({
        id: 'cat1',
        isActive: false,
      });

      await service.remove('cat1');

      expect(redis.del).toHaveBeenCalledWith('cache:categories:tree:v1');
    });
  });

  describe('findBySlug', () => {
    it('should return category by slug', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 'cat1',
        name: 'Fantasy',
        slug: 'fantasy',
      });

      const result = await service.findBySlug('fantasy');

      expect(result.slug).toBe('fantasy');
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDescendantIds', () => {
    it('should return children and grandchildren IDs', async () => {

      (prisma.category.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: 'child-1' }, { id: 'child-2' }])

        .mockResolvedValueOnce([{ id: 'grandchild-1' }])

        .mockResolvedValueOnce([]);

      const result = await service.getDescendantIds('root');

      expect(result).toEqual(['child-1', 'child-2', 'grandchild-1']);
    });

    it('should return empty array for leaf category', async () => {
      (prisma.category.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getDescendantIds('leaf');

      expect(result).toEqual([]);
    });

    it('should handle 3 levels of nesting', async () => {
      (prisma.category.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: 'l1' }])
        .mockResolvedValueOnce([{ id: 'l2' }])
        .mockResolvedValueOnce([{ id: 'l3' }])
        .mockResolvedValueOnce([]);

      const result = await service.getDescendantIds('root');

      expect(result).toEqual(['l1', 'l2', 'l3']);
    });
  });

  describe('getAncestors', () => {
    it('should return parent chain from child to root', async () => {
      (prisma.category.findUnique as jest.Mock)

        .mockResolvedValueOnce({
          id: 'child',
          parentId: 'parent',
          name: 'Child',
        })

        .mockResolvedValueOnce({
          id: 'parent',
          parentId: 'root',
          name: 'Parent',
        })

        .mockResolvedValueOnce({ id: 'root', parentId: null, name: 'Root' });

      const result = await service.getAncestors('child');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('parent');
      expect(result[1].id).toBe('root');
    });

    it('should return empty array for root category', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'root',
        parentId: null,
        name: 'Root',
      });

      const result = await service.getAncestors('root');

      expect(result).toEqual([]);
    });
  });

  describe('resolveInheritedField', () => {
    it('should return parent scaleRuleSetId when child has none', async () => {
      (prisma.category.findUnique as jest.Mock)

        .mockResolvedValueOnce({
          id: 'child',
          parentId: 'parent',
          scaleRuleSetId: null,
          extraDays: null,
        })

        .mockResolvedValueOnce({
          id: 'child',
          parentId: 'parent',
          scaleRuleSetId: null,
          extraDays: null,
        })

        .mockResolvedValueOnce({
          id: 'parent',
          parentId: null,
          scaleRuleSetId: 'rule-1',
          extraDays: null,
        });

      const result = await service.resolveInheritedField(
        'child',
        'scaleRuleSetId',
      );

      expect(result).toBe('rule-1');
    });

    it('should return own value when category has it', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'child',
        parentId: 'parent',
        scaleRuleSetId: 'own-rule',
        extraDays: null,
      });

      const result = await service.resolveInheritedField(
        'child',
        'scaleRuleSetId',
      );

      expect(result).toBe('own-rule');
    });

    it('should walk up multiple levels for extraDays', async () => {
      (prisma.category.findUnique as jest.Mock)

        .mockResolvedValueOnce({
          id: 'gc',
          parentId: 'child',
          scaleRuleSetId: null,
          extraDays: null,
        })

        .mockResolvedValueOnce({
          id: 'gc',
          parentId: 'child',
          scaleRuleSetId: null,
          extraDays: null,
        })

        .mockResolvedValueOnce({
          id: 'child',
          parentId: 'root',
          scaleRuleSetId: null,
          extraDays: null,
        })

        .mockResolvedValueOnce({
          id: 'root',
          parentId: null,
          scaleRuleSetId: null,
          extraDays: 5,
        });

      const result = await service.resolveInheritedField('gc', 'extraDays');

      expect(result).toBe(5);
    });

    it('should return null when no ancestor has the value', async () => {
      (prisma.category.findUnique as jest.Mock)

        .mockResolvedValueOnce({
          id: 'child',
          parentId: 'root',
          extraDays: null,
          scaleRuleSetId: null,
        })

        .mockResolvedValueOnce({
          id: 'child',
          parentId: 'root',
          extraDays: null,
          scaleRuleSetId: null,
        })

        .mockResolvedValueOnce({
          id: 'root',
          parentId: null,
          extraDays: null,
          scaleRuleSetId: null,
        });

      const result = await service.resolveInheritedField('child', 'extraDays');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update category and regenerate slug if name changes', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.category.update as jest.Mock).mockResolvedValue({
        id: 'cat1',
        name: 'Sci-Fi',
        slug: 'sci-fi',
      });

      const result = await service.update('cat1', { name: 'Sci-Fi' });

      expect(result.slug).toBe('sci-fi');
    });
  });
});
