import { Test, TestingModule } from '@nestjs/testing';
import { GoogleCategoriesService } from './google-categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('GoogleCategoriesService', () => {
  let service: GoogleCategoriesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      googleCategory: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleCategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GoogleCategoriesService>(GoogleCategoriesService);
  });

  describe('findById', () => {
    it('returns the category when found', async () => {
      prisma.googleCategory.findUnique.mockResolvedValue({
        id: '1253',
        name: 'Action Figures',
        path: 'Toys > Figures > Action Figures',
      });

      const result = await service.findById('1253');

      expect(result.path).toContain('Action Figures');
    });

    it('throws NotFoundException for unknown id', async () => {
      prisma.googleCategory.findUnique.mockResolvedValue(null);
      await expect(service.findById('99999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('search', () => {
    it('searches by case-insensitive contains on path', async () => {
      prisma.googleCategory.findMany.mockResolvedValue([
        { id: '1', path: 'Toys > Figures > Action Figures' },
      ]);

      await service.search('action figures');

      expect(prisma.googleCategory.findMany).toHaveBeenCalledWith({
        where: {
          path: { contains: 'action figures', mode: 'insensitive' },
        },
        orderBy: { path: 'asc' },
        take: 20,
      });
    });

    it('respects custom limit', async () => {
      prisma.googleCategory.findMany.mockResolvedValue([]);
      await service.search('toys', 50);
      expect(prisma.googleCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('returns empty array for empty query', async () => {
      const result = await service.search('');
      expect(result).toEqual([]);
      expect(prisma.googleCategory.findMany).not.toHaveBeenCalled();
    });

    it('returns empty array for whitespace-only query', async () => {
      const result = await service.search('   ');
      expect(result).toEqual([]);
      expect(prisma.googleCategory.findMany).not.toHaveBeenCalled();
    });
  });
});
