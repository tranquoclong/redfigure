import { Test, TestingModule } from '@nestjs/testing';
import { RecentlyViewedController } from './recently-viewed.controller';
import { RecentlyViewedService } from './recently-viewed.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RecentlyViewedController', () => {
  let controller: RecentlyViewedController;

  const mockService = {
    resolveOwner: jest.fn(),
    recordView: jest.fn().mockResolvedValue(undefined),
    getViewed: jest.fn().mockResolvedValue([]),
    getViewedByUserId: jest.fn().mockResolvedValue([]),
    merge: jest.fn().mockResolvedValue(undefined),
  };

  const mockProduct = {
    id: 'prod-1',
    name: 'Test Product',
    slug: 'test-product',
    basePrice: 49.9,
    salePrice: null,
    type: 'simple',
    isActive: true,
    isDraft: false,
    images: [{ mediaFile: { card: '/img/card.webp' } }],
    variations: [],
    productCategories: [
      { category: { id: 'cat-1', name: 'Pinups', slug: 'pinups' } },
    ],
  };

  const mockPrisma = {
    product: {
      findMany: jest.fn().mockResolvedValue([mockProduct]),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecentlyViewedController],
      providers: [
        { provide: RecentlyViewedService, useValue: mockService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get(RecentlyViewedController);
    jest.clearAllMocks();

    mockService.resolveOwner.mockReturnValue({
      userId: 'user-123',
      sessionId: '12345678-1234-4aaa-9bbb-123456789abc',
    });
    mockService.getViewed.mockResolvedValue([]);
    mockService.getViewedByUserId.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
  });

  describe('POST /:productId — recordView', () => {
    it('should record view using resolved owner', async () => {
      const result = await controller.recordView(
        { id: 'user-123' } as any,
        '12345678-1234-4aaa-9bbb-123456789abc',
        'prod-1',
      );

      expect(mockService.resolveOwner).toHaveBeenCalledWith(
        'user-123',
        '12345678-1234-4aaa-9bbb-123456789abc',
      );
      expect(mockService.recordView).toHaveBeenCalledWith(
        'user-123',
        '12345678-1234-4aaa-9bbb-123456789abc',
        'prod-1',
      );
      expect(result).toEqual({ data: { recorded: true } });
    });

    it('should work for anonymous users', async () => {
      mockService.resolveOwner.mockReturnValue({
        userId: null,
        sessionId: '12345678-1234-4aaa-9bbb-123456789abc',
      });

      await controller.recordView(
        undefined,
        '12345678-1234-4aaa-9bbb-123456789abc',
        'prod-1',
      );

      expect(mockService.recordView).toHaveBeenCalledWith(
        null,
        '12345678-1234-4aaa-9bbb-123456789abc',
        'prod-1',
      );
    });
  });

  describe('GET / — getRecentlyViewed', () => {
    it('should return hydrated products', async () => {
      mockService.getViewed.mockResolvedValue(['prod-1']);

      const result = await controller.getRecentlyViewed(
        { id: 'user-123' } as any,
        '12345678-1234-4aaa-9bbb-123456789abc',
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('prod-1');
    });

    it('should return empty when no views', async () => {
      mockService.getViewed.mockResolvedValue([]);

      const result = await controller.getRecentlyViewed(
        { id: 'user-123' } as any,
        '12345678-1234-4aaa-9bbb-123456789abc',
      );

      expect(result).toEqual({ data: [] });
      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
    });
  });

  describe('POST /merge — mergeViewed', () => {
    it('should merge views for authenticated user', async () => {
      const result = await controller.mergeViewed({ id: 'user-123' } as any, {
        sessionId: '12345678-1234-4aaa-9bbb-123456789abc',
      });

      expect(mockService.merge).toHaveBeenCalledWith(
        'user-123',
        '12345678-1234-4aaa-9bbb-123456789abc',
      );
      expect(result).toEqual({ data: { merged: true } });
    });

    it('should return merged:false when no user', async () => {
      const result = await controller.mergeViewed(undefined as any, {
        sessionId: '12345678-1234-4aaa-9bbb-123456789abc',
      });

      expect(mockService.merge).not.toHaveBeenCalled();
      expect(result).toEqual({ data: { merged: false } });
    });
  });

  describe('GET /user/:userId — admin endpoint', () => {
    it('should return products for a given userId', async () => {
      mockService.getViewedByUserId.mockResolvedValue(['prod-1']);

      const result = await controller.getAdminUserViewed('target-user');

      expect(mockService.getViewedByUserId).toHaveBeenCalledWith('target-user');
      expect(result.data).toHaveLength(1);
    });

    it('should return empty when user has no views', async () => {
      mockService.getViewedByUserId.mockResolvedValue([]);

      const result = await controller.getAdminUserViewed('target-user');
      expect(result).toEqual({ data: [] });
    });
  });
});
