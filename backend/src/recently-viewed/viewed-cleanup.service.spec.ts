import { Test, TestingModule } from '@nestjs/testing';
import { ViewedCleanupService } from './viewed-cleanup.service';
import { RecentlyViewedService } from './recently-viewed.service';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('ViewedCleanupService', () => {
  let service: ViewedCleanupService;

  const mockRecentlyViewedService = {
    cleanupAnonymous: jest.fn().mockResolvedValue(0),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViewedCleanupService,
        {
          provide: RecentlyViewedService,
          useValue: mockRecentlyViewedService,
        },
        {
          provide: 'REDIS_CONNECTION',
          useValue: { host: 'localhost', port: 6379 },
        },
      ],
    }).compile();

    service = module.get(ViewedCleanupService);
    jest.clearAllMocks();
  });

  describe('processCleanup', () => {
    it('should call cleanupAnonymous on the service', async () => {
      mockRecentlyViewedService.cleanupAnonymous.mockResolvedValue(5);

      await service.processCleanup();

      expect(mockRecentlyViewedService.cleanupAnonymous).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should handle zero deletions', async () => {
      mockRecentlyViewedService.cleanupAnonymous.mockResolvedValue(0);

      await service.processCleanup();

      expect(mockRecentlyViewedService.cleanupAnonymous).toHaveBeenCalledTimes(
        1,
      );
    });
  });
});
