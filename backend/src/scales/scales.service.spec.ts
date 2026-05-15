import { Test, TestingModule } from '@nestjs/testing';
import { ScalesService } from './scales.service';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { NotFoundException } from '@nestjs/common';

describe('ScalesService', () => {
  let service: ScalesService;
  let prisma: PrismaService;
  let mockCategoriesService: any;

  beforeEach(async () => {
    mockCategoriesService = {
      getAncestors: jest.fn().mockResolvedValue([]),
      resolveInheritedField: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScalesService,
        {
          provide: PrismaService,
          useValue: {
            scaleRuleSet: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            scaleRuleItem: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            product: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
      ],
    }).compile();

    service = module.get<ScalesService>(ScalesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createRuleSet', () => {
    it('should create a rule set (empty, items added later)', async () => {
      (prisma.scaleRuleSet.create as jest.Mock).mockResolvedValue({
        id: 'rs1',
        name: 'Standard Miniatures',
        items: [],
      });

      const result = await service.createRuleSet({ name: 'Standard Miniatures' });

      expect(result.name).toBe('Standard Miniatures');
      expect(result.items).toEqual([]);
      expect(prisma.scaleRuleSet.create).toHaveBeenCalledWith({
        data: { name: 'Standard Miniatures' },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  });

  describe('findAllRuleSets', () => {
    it('should return active rule sets with items ordered by sortOrder', async () => {
      (prisma.scaleRuleSet.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rs1',
          name: 'Standard Miniatures',
          items: [
            { id: 'i1', name: '28mm', percentageIncrease: 0, sortOrder: 0 },
            { id: 'i2', name: '32mm', percentageIncrease: 15, sortOrder: 1 },
          ],
        },
      ]);

      const result = await service.findAllRuleSets();

      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(2);
      expect(prisma.scaleRuleSet.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findRuleSetById', () => {
    it('should return rule set by id', async () => {
      (prisma.scaleRuleSet.findUnique as jest.Mock).mockResolvedValue({
        id: 'rs1',
        name: 'Test',
        items: [],
      });

      const result = await service.findRuleSetById('rs1');
      expect(result.id).toBe('rs1');
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.scaleRuleSet.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findRuleSetById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeRuleSet', () => {
    it('should delete rule set (cascade deletes items)', async () => {
      (prisma.scaleRuleSet.findUnique as jest.Mock).mockResolvedValue({
        id: 'rs1',
        name: 'Test',
        items: [],
      });
      (prisma.scaleRuleSet.delete as jest.Mock).mockResolvedValue({
        id: 'rs1',
      });

      await service.removeRuleSet('rs1');

      expect(prisma.scaleRuleSet.delete).toHaveBeenCalledWith({
        where: { id: 'rs1' },
      });
    });
  });

  describe('addItem', () => {
    it('should add an item to a rule set', async () => {
      (prisma.scaleRuleSet.findUnique as jest.Mock).mockResolvedValue({
        id: 'rs1',
        name: 'Test',
        items: [],
      });
      (prisma.scaleRuleItem.create as jest.Mock).mockResolvedValue({
        id: 'i1',
        ruleSetId: 'rs1',
        name: '28mm',
        percentageIncrease: 0,
        sortOrder: 0,
      });

      const result = await service.addItem('rs1', {
        name: '28mm',
        percentageIncrease: 0,
        sortOrder: 0,
      });

      expect(result.name).toBe('28mm');
      expect(prisma.scaleRuleItem.create).toHaveBeenCalledWith({
        data: {
          ruleSetId: 'rs1',
          name: '28mm',
          percentageIncrease: 0,
          sortOrder: 0,
        },
      });
    });

    it('should throw if rule set not found', async () => {
      (prisma.scaleRuleSet.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.addItem('nonexistent', { name: '28mm', percentageIncrease: 0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateItem', () => {
    it('should update an existing item', async () => {
      (prisma.scaleRuleItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'i1',
        name: '28mm',
        percentageIncrease: 0,
      });
      (prisma.scaleRuleItem.update as jest.Mock).mockResolvedValue({
        id: 'i1',
        name: '28mm',
        percentageIncrease: 10,
      });

      const result = await service.updateItem('i1', { percentageIncrease: 10 });
      expect(result.percentageIncrease).toBe(10);
    });

    it('should throw if item not found', async () => {
      (prisma.scaleRuleItem.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateItem('nonexistent', { name: '32mm' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    it('should delete an item', async () => {
      (prisma.scaleRuleItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'i1',
      });
      (prisma.scaleRuleItem.delete as jest.Mock).mockResolvedValue({
        id: 'i1',
      });

      await service.removeItem('i1');
      expect(prisma.scaleRuleItem.delete).toHaveBeenCalledWith({
        where: { id: 'i1' },
      });
    });

    it('should throw if item not found', async () => {
      (prisma.scaleRuleItem.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.removeItem('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resolveScaleRule', () => {
    it('should return null if product has noScales=true', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: true,
        scaleRuleSet: { id: 'rs1', name: 'X', items: [] },
        tags: [],
        productCategories: [],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result).toBeNull();
    });

    it('should return product rule set if defined (highest priority)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: {
          id: 'rs1',
          name: 'Product Rule',
          items: [{ id: 'i1', name: '28mm', percentageIncrease: 0 }],
        },
        tags: [
          { noScales: false, scaleRuleSet: { id: 'rs2', name: 'Tag Rule' } },
        ],
        productCategories: [
          {
            categoryId: 'c1',
            category: { scaleRuleSet: { id: 'rs3', name: 'Cat Rule' } },
          },
        ],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Product Rule');
    });

    it('should return null if any tag has noScales=true', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [{ noScales: true, scaleRuleSet: { id: 'rs2' } }],
        productCategories: [
          {
            categoryId: 'c1',
            category: { scaleRuleSet: { id: 'rs3', name: 'Cat Rule' } },
          },
        ],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result).toBeNull();
    });

    it('should fallback to tag rule set', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [
          { noScales: false, scaleRuleSet: null },
          {
            noScales: false,
            scaleRuleSet: {
              id: 'rs2',
              name: 'Tag Rule',
              items: [{ id: 'i1', name: '28mm', percentageIncrease: 10 }],
            },
          },
        ],
        productCategories: [
          { categoryId: 'c1', category: { scaleRuleSet: { id: 'rs3' } } },
        ],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Tag Rule');
    });

    it('should return null when no rule applies', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [],
        productCategories: [],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result).toBeNull();
    });

    it('should throw if product not found', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.resolveScaleRule('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('calculateScalePrice', () => {
    it('should apply percentage increase', () => {
      expect(service.calculateScalePrice(100, 15)).toBe(115);
      expect(service.calculateScalePrice(79, 80)).toBe(142.2);
      expect(service.calculateScalePrice(49.9, 150)).toBe(124.75);
    });

    it('should return base price for 0% increase', () => {
      expect(service.calculateScalePrice(100, 0)).toBe(100);
    });
  });

  describe('resolveScaleRule — brand cascade', () => {
    it('should return null if brand has noScales=true (no fallback to category)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [],
        brand: { noScales: true, scaleRuleSet: null },
        productCategories: [
          {
            categoryId: 'c1',
            category: { scaleRuleSet: { id: 'rs-cat', name: 'Cat Rule' } },
          },
        ],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result).toBeNull();
    });

    it('should fallback to brand rule set when product+tag have none', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [],
        brand: {
          noScales: false,
          scaleRuleSet: {
            id: 'rs-brand',
            name: 'Brand Rule',
            items: [{ id: 'i1', name: '32mm', percentageIncrease: 15 }],
          },
        },
        productCategories: [
          {
            categoryId: 'c1',
            category: { scaleRuleSet: { id: 'rs-cat', name: 'Cat Rule' } },
          },
        ],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Brand Rule');
    });

    it('should prefer tag rule set over brand rule set', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [
          {
            noScales: false,
            scaleRuleSet: { id: 'rs-tag', name: 'Tag Rule' },
          },
        ],
        brand: {
          noScales: false,
          scaleRuleSet: { id: 'rs-brand', name: 'Brand Rule' },
        },
        productCategories: [],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Tag Rule');
    });

    it('should fallback to category when brand has no scaleRuleSet', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [],
        brand: { noScales: false, scaleRuleSet: null },
        productCategories: [
          {
            categoryId: 'c1',
            category: { scaleRuleSet: { id: 'rs-cat', name: 'Cat Rule' } },
          },
        ],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Cat Rule');
    });

    it('should still resolve category when product has no brand', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [],
        brand: null,
        productCategories: [
          {
            categoryId: 'c1',
            category: { scaleRuleSet: { id: 'rs-cat', name: 'Cat Rule' } },
          },
        ],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Cat Rule');
    });
  });

  describe('resolveScaleRule — category hierarchy', () => {
    it('should use productCategories for category rule resolution', async () => {
      const categoryRule = {
        id: 'rs-cat',
        name: 'Category Rule',
        items: [{ id: 'i1', name: '32mm', percentageIncrease: 20 }],
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [],
        productCategories: [
          { categoryId: 'cat-1', category: { scaleRuleSet: categoryRule } },
        ],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Category Rule');
    });

    it('should walk up ancestors when direct category has no scaleRuleSet', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [],
        productCategories: [
          { categoryId: 'child-cat', category: { scaleRuleSet: null } },
        ],
      });
      mockCategoriesService.getAncestors.mockResolvedValue([
        { id: 'parent-cat', scaleRuleSetId: 'rs-parent' },
      ]);
      (prisma.scaleRuleSet.findUnique as jest.Mock).mockResolvedValue({
        id: 'rs-parent',
        name: 'Parent Rule',
        items: [{ id: 'i2', name: '28mm', percentageIncrease: 0 }],
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Parent Rule');
      expect(mockCategoriesService.getAncestors).toHaveBeenCalledWith(
        'child-cat',
      );
    });

    it('should return null when no category in hierarchy has scaleRuleSet', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSet: null,
        tags: [],
        productCategories: [
          { categoryId: 'leaf', category: { scaleRuleSet: null } },
        ],
      });
      mockCategoriesService.getAncestors.mockResolvedValue([
        { id: 'root', scaleRuleSetId: null },
      ]);

      const result = await service.resolveScaleRule('p1');
      expect(result).toBeNull();
    });
  });
});
