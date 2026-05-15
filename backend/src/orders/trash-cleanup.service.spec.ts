import { Test, TestingModule } from '@nestjs/testing';
import { TrashCleanupService } from './trash-cleanup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TrashCleanupService', () => {
  let service: TrashCleanupService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrashCleanupService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              findMany: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: 'REDIS_CONNECTION',
          useValue: { host: 'localhost', port: 6379 },
        },
      ],
    }).compile();

    service = module.get<TrashCleanupService>(TrashCleanupService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {

    await (service as any).queue?.close();
  });

  describe('processCleanup', () => {
    it('deletes orders with deletedAt prior to the cutoff (30 days)', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      prisma.order.findMany.mockResolvedValue([
        { id: 'order-old-1' },
        { id: 'order-old-2' },
      ]);

      await service.processCleanup();

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: { lt: expect.any(Date) },
        },
        select: { id: true },
      });

      const cutoffArg = prisma.order.findMany.mock.calls[0][0].where.deletedAt
        .lt as Date;

      const expectedMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(cutoffArg.getTime() - expectedMs)).toBeLessThan(60_000);

      expect(oldDate.getTime()).toBeLessThan(cutoffArg.getTime());

      expect(prisma.order.delete).toHaveBeenCalledTimes(2);
      expect(prisma.order.delete).toHaveBeenCalledWith({
        where: { id: 'order-old-1' },
      });
      expect(prisma.order.delete).toHaveBeenCalledWith({
        where: { id: 'order-old-2' },
      });
    });

    it('does not delete anything when there are no expired orders', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.processCleanup();

      expect(prisma.order.delete).not.toHaveBeenCalled();
    });

    it('continues when a deletion fails (does not interrupt the batch)', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'order1' },
        { id: 'order2' },
        { id: 'order3' },
      ]);
      prisma.order.delete
        .mockRejectedValueOnce(new Error('FK violation'))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await service.processCleanup();

      expect(prisma.order.delete).toHaveBeenCalledTimes(3);
    });
  });
});
