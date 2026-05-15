import { Test, TestingModule } from '@nestjs/testing';
import {
  AttributeMatcherService,
  normalizeValue,
  levenshteinDistance,
} from './attribute-matcher.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AttributeMatcherService', () => {
  let service: AttributeMatcherService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      attribute: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributeMatcherService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AttributeMatcherService>(AttributeMatcherService);
  });

  describe('normalizeValue', () => {
    it('should lowercase and remove accents', () => {
      expect(normalizeValue('Fantasies')).toBe('fantasy');
      expect(normalizeValue('Gothic')).toBe('gothic');
    });

    it('should singularize plurals', () => {
      expect(normalizeValue('Warriors')).toBe('warrior');
      expect(normalizeValue('Swords')).toBe('sword');
    });

    it('should singularize', () => {
      expect(normalizeValue('Dragons')).toBe('dragon');
    });

    it('should trim whitespace', () => {
      expect(normalizeValue('  Fantasy  ')).toBe('fantasy');
    });
  });

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('abc', 'abc')).toBe(0);
    });

    it('should return correct distance for simple edits', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('should return 1 for single character difference', () => {
      expect(levenshteinDistance('fantasy', 'fantasye')).toBe(1);
    });

    it('should return 2 for transposed characters', () => {
      expect(levenshteinDistance('fatnasye', 'fantasy')).toBe(2);
    });
  });

  describe('matchAttributes', () => {
    const mockAttributes = [
      {
        id: 'attr-style',
        name: 'Style',
        slug: 'style',
        values: [
          { id: 'val-fantasy', value: 'Fantasy', slug: 'fantasy' },
          { id: 'val-cyberpunk', value: 'Cyberpunk', slug: 'cyberpunk' },
          { id: 'val-gothic', value: 'Gothic', slug: 'gothic' },
        ],
      },
    ];

    beforeEach(() => {
      prisma.attribute.findMany.mockResolvedValue(mockAttributes);
    });

    it('should match exact values', async () => {
      const result = await service.matchAttributes({
        Style: ['Fantasy'],
        Pose: ['Pose'],
      });

      expect(result.matched).toHaveLength(2);
      expect(result.matched[0]).toMatchObject({
        attributeValueId: 'val-fantasy',
        attributeName: 'Style',
        value: 'Fantasy',
        confidence: 'exact',
      });
      expect(result.matched[1]).toMatchObject({
        attributeValueId: 'val-pose',
        attributeName: 'Pose',
        value: 'Pose',
        confidence: 'exact',
      });
    });

    it('should match after normalization (plural → singular)', async () => {
      const result = await service.matchAttributes({
        Style: ['Fantasies'],
      });

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0]).toMatchObject({
        attributeValueId: 'val-fantasy',
        confidence: 'exact',
      });
    });

    it('should fuzzy match with small typo', async () => {
      const result = await service.matchAttributes({
        Style: ['Fantasye'],
      });

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0]).toMatchObject({
        attributeValueId: 'val-fantasy',
        confidence: 'fuzzy',
        aiOriginal: 'Fantasye',
      });
    });

    it('should match by containment', async () => {
      const result = await service.matchAttributes({
        Clothing: ['Armor'],
      });

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0]).toMatchObject({
        attributeValueId: 'val-armor',
        confidence: 'fuzzy',
        aiOriginal: 'Armor',
      });
    });

    it('should return unmatched for unknown values', async () => {
      const result = await service.matchAttributes({
        Style: ['Tribal'],
      });

      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(1);
      expect(result.unmatched[0]).toMatchObject({
        attributeName: 'Style',
        value: 'Tribal',
        confidence: 'new',
      });
    });

    it('should skip attributes not found in database', async () => {
      const result = await service.matchAttributes({
        NonExistentAttr: ['Value'],
      });

      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(0);
    });

    it('should handle mixed results (some matched, some not)', async () => {
      const result = await service.matchAttributes({
        Style: ['Fantasy', 'Tribal'],
        Clothing: ['Armor'],
      });

      expect(result.matched).toHaveLength(2);
      expect(result.unmatched).toHaveLength(1);
    });

    it('should also match attribute by slug', async () => {
      const result = await service.matchAttributes({
        Clothing: ['Lingerie'],
      });

      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].attributeValueId).toBe('val-lingerie');
    });
  });
});
