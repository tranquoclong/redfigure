import { Test, TestingModule } from '@nestjs/testing';
import { FeaturedCategoriesService } from './featured-categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('FeaturedCategoriesService', () => {
  let service: FeaturedCategoriesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeaturedCategoriesService,
        {
          provide: PrismaService,
          useValue: {
            featuredCategory: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: { del: jest.fn().mockResolvedValue(1) },
        },
      ],
    }).compile();

    service = module.get(FeaturedCategoriesService);
    prisma = module.get(PrismaService);
  });

  describe('findActive', () => {
    it('returns active featured categories where the underlying category is also active', async () => {
      (prisma.featuredCategory.findMany as jest.Mock).mockResolvedValue([]);
      await service.findActive();
      expect(prisma.featuredCategory.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          category: { isActive: true },
        },
        include: { category: true },
        orderBy: { order: 'asc' },
      });
    });
  });

  describe('findAll (admin)', () => {
    it('returns all featured categories with category data', async () => {
      (prisma.featuredCategory.findMany as jest.Mock).mockResolvedValue([]);
      await service.findAll();
      expect(prisma.featuredCategory.findMany).toHaveBeenCalledWith({
        include: { category: true },
        orderBy: { order: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('creates a featured category with default order', async () => {
      (prisma.featuredCategory.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.featuredCategory.create as jest.Mock).mockResolvedValue({
        id: 'fc1',
      });
      await service.create({ categoryId: 'c1', glowColor: '#ff007a' });
      expect(prisma.featuredCategory.create).toHaveBeenCalledWith({
        data: {
          categoryId: 'c1',
          glowColor: '#ff007a',
        },
        include: { category: true },
      });
    });

    it('throws ConflictException if the category is already featured', async () => {
      (prisma.featuredCategory.findUnique as jest.Mock).mockResolvedValue({
        id: 'fc1',
      });
      await expect(
        service.create({ categoryId: 'c1', glowColor: '#ff007a' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.featuredCategory.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the featured category', async () => {
      (prisma.featuredCategory.findUnique as jest.Mock).mockResolvedValue({
        id: 'fc1',
      });
      (prisma.featuredCategory.update as jest.Mock).mockResolvedValue({});
      await service.update('fc1', { glowColor: '#00f0ff', order: 2 });
      expect(prisma.featuredCategory.update).toHaveBeenCalledWith({
        where: { id: 'fc1' },
        data: { glowColor: '#00f0ff', order: 2 },
        include: { category: true },
      });
    });

    it('throws NotFoundException when not found', async () => {
      (prisma.featuredCategory.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.update('nope', { order: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('removes the featured category', async () => {
      (prisma.featuredCategory.findUnique as jest.Mock).mockResolvedValue({
        id: 'fc1',
      });
      (prisma.featuredCategory.delete as jest.Mock).mockResolvedValue({});
      await service.remove('fc1');
      expect(prisma.featuredCategory.delete).toHaveBeenCalledWith({
        where: { id: 'fc1' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      (prisma.featuredCategory.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('updates the order field for each item', async () => {
      (prisma.featuredCategory.update as jest.Mock).mockResolvedValue({});
      await service.reorder([
        { id: 'fc1', order: 0 },
        { id: 'fc2', order: 1 },
      ]);
      expect(prisma.featuredCategory.update).toHaveBeenCalledTimes(2);
    });
  });
});
