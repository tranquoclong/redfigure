import { Test, TestingModule } from '@nestjs/testing';
import { CartAbandonmentCronService } from './cart-abandonment.cron.service';
import { CartAbandonmentService } from './cart-abandonment.service';

const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
const mockQueueClose = jest.fn();
const mockQueueOn = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
    on: mockQueueOn,
  })),
}));

describe('CartAbandonmentCronService', () => {
  let cron: CartAbandonmentCronService;
  let service: any;

  beforeEach(async () => {
    mockQueueAdd.mockClear();
    mockQueueClose.mockClear();
    mockQueueOn.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartAbandonmentCronService,
        {
          provide: CartAbandonmentService,
          useValue: {
            processAbandonedCarts: jest.fn().mockResolvedValue({
              firstSent: 0,
              secondSent: 0,
              skipped: 0,
            }),
          },
        },
        {
          provide: 'REDIS_CONNECTION',
          useValue: { host: 'localhost', port: 6379 },
        },
      ],
    }).compile();

    cron = module.get(CartAbandonmentCronService);
    service = module.get(CartAbandonmentService);
  });

  it('onModuleInit registers a recurring job daily at 01:00 with a fixed jobId.', async () => {
    await cron.onModuleInit();

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = mockQueueAdd.mock.calls[0];
    expect(name).toBe('process-abandoned-carts');
    expect(payload).toEqual({});
    expect(opts.repeat.pattern).toBe('0 1 * * *');
    expect(typeof opts.jobId).toBe('string');
    expect(opts.jobId.length).toBeGreaterThan(0);
  });

  it('processCleanup delegates to CartAbandonmentService.processAbandonedCarts', async () => {
    service.processAbandonedCarts.mockResolvedValueOnce({
      firstSent: 3,
      secondSent: 1,
      skipped: 2,
    });

    const result = await cron.processCleanup();

    expect(service.processAbandonedCarts).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ firstSent: 3, secondSent: 1, skipped: 2 });
  });

  it('onModuleDestroy closes the queue', async () => {
    await cron.onModuleInit();
    await cron.onModuleDestroy();
    expect(mockQueueClose).toHaveBeenCalledTimes(1);
  });

  it('failure to schedule does not bring down the boot (catch + log)', async () => {
    mockQueueAdd.mockRejectedValueOnce(new Error('redis down'));

    await expect(cron.onModuleInit()).resolves.not.toThrow();
  });
});
