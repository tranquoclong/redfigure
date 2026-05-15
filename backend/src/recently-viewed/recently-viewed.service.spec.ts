import { Test, TestingModule } from '@nestjs/testing';
import { RecentlyViewedService } from './recently-viewed.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('RecentlyViewedService', () => {
  let service: RecentlyViewedService;

  const mockPrisma = {
    recentlyViewed: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecentlyViewedService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(RecentlyViewedService);
    jest.clearAllMocks();
  });

  describe('resolveOwner', () => {
    it('should return userId + sessionId when user is logged in', () => {
      const result = service.resolveOwner('user-123', 'sess-abc');
      expect(result).toEqual({ userId: 'user-123', sessionId: 'sess-abc' });
    });

    it('should return null userId for anonymous users', () => {
      const result = service.resolveOwner(undefined, 'sess-abc');
      expect(result).toEqual({ userId: null, sessionId: 'sess-abc' });
    });

    it('should throw when sessionId is missing', () => {
      expect(() => service.resolveOwner(undefined, undefined)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('recordView', () => {
    it('should upsert with sessionId + productId as unique key', async () => {
      await service.recordView('user-123', 'sess-abc', 'prod-1');

      expect(mockPrisma.recentlyViewed.upsert).toHaveBeenCalledWith({
        where: {
          sessionId_productId: { sessionId: 'sess-abc', productId: 'prod-1' },
        },
        update: expect.objectContaining({ userId: 'user-123' }),
        create: {
          sessionId: 'sess-abc',
          productId: 'prod-1',
          userId: 'user-123',
        },
      });
    });

    it('should upsert without userId for anonymous users', async () => {
      await service.recordView(null, 'sess-abc', 'prod-1');

      expect(mockPrisma.recentlyViewed.upsert).toHaveBeenCalledWith({
        where: {
          sessionId_productId: { sessionId: 'sess-abc', productId: 'prod-1' },
        },
        update: expect.objectContaining({}),
        create: {
          sessionId: 'sess-abc',
          productId: 'prod-1',
          userId: null,
        },
      });
    });
  });

  describe('getViewed', () => {
    it('should query by userId when logged in', async () => {
      mockPrisma.recentlyViewed.findMany.mockResolvedValue([
        { productId: 'prod-2' },
        { productId: 'prod-1' },
      ]);

      const result = await service.getViewed('user-123', 'sess-abc');

      expect(mockPrisma.recentlyViewed.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        select: { productId: true },
        orderBy: { viewedAt: 'desc' },
        take: 18,
      });
      expect(result).toEqual(['prod-2', 'prod-1']);
    });

    it('should query by sessionId + null userId for anonymous', async () => {
      mockPrisma.recentlyViewed.findMany.mockResolvedValue([
        { productId: 'prod-3' },
      ]);

      const result = await service.getViewed(null, 'sess-abc');

      expect(mockPrisma.recentlyViewed.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'sess-abc', userId: null },
        select: { productId: true },
        orderBy: { viewedAt: 'desc' },
        take: 18,
      });
      expect(result).toEqual(['prod-3']);
    });

    it('should return empty array when no views', async () => {
      mockPrisma.recentlyViewed.findMany.mockResolvedValue([]);

      const result = await service.getViewed('user-123', 'sess-abc');
      expect(result).toEqual([]);
    });
  });

  describe('getViewedByUserId', () => {
    it('should query by userId for admin', async () => {
      mockPrisma.recentlyViewed.findMany.mockResolvedValue([
        { productId: 'prod-1' },
      ]);

      const result = await service.getViewedByUserId('target-user');

      expect(mockPrisma.recentlyViewed.findMany).toHaveBeenCalledWith({
        where: { userId: 'target-user' },
        select: { productId: true },
        orderBy: { viewedAt: 'desc' },
        take: 18,
      });
      expect(result).toEqual(['prod-1']);
    });
  });

  describe('merge', () => {
    it('should link anonymous views to user and skip duplicates', async () => {

      mockPrisma.recentlyViewed.findMany.mockResolvedValue([
        { productId: 'prod-1' },
      ]);

      await service.merge('user-123', 'sess-abc');

      expect(mockPrisma.recentlyViewed.updateMany).toHaveBeenCalledWith({
        where: {
          sessionId: 'sess-abc',
          userId: null,
          productId: { notIn: ['prod-1'] },
        },
        data: { userId: 'user-123' },
      });

      expect(mockPrisma.recentlyViewed.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'sess-abc', userId: null },
      });
    });

    it('should claim all anon views when user has no existing views', async () => {
      mockPrisma.recentlyViewed.findMany.mockResolvedValue([]);

      await service.merge('user-123', 'sess-abc');

      expect(mockPrisma.recentlyViewed.updateMany).toHaveBeenCalledWith({
        where: {
          sessionId: 'sess-abc',
          userId: null,
          productId: { notIn: [] },
        },
        data: { userId: 'user-123' },
      });
    });
  });

  describe('cleanupAnonymous', () => {
    it('should delete anonymous records older than 30 days', async () => {
      mockPrisma.recentlyViewed.deleteMany.mockResolvedValue({ count: 5 });

      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const result = await service.cleanupAnonymous();

      expect(mockPrisma.recentlyViewed.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: null,
          viewedAt: { lt: new Date(now - 30 * 24 * 60 * 60 * 1000) },
        },
      });
      expect(result).toBe(5);

      jest.restoreAllMocks();
    });
  });
});
