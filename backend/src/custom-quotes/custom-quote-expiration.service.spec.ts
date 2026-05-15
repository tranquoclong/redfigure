import { Test, TestingModule } from '@nestjs/testing';
import { CustomQuoteExpirationService } from './custom-quote-expiration.service';
import { CustomQuotesService } from './custom-quotes.service';

describe('CustomQuoteExpirationService', () => {
  let service: CustomQuoteExpirationService;
  let quotes: { expireOutdated: jest.Mock };

  beforeEach(async () => {
    quotes = { expireOutdated: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomQuoteExpirationService,
        { provide: CustomQuotesService, useValue: quotes },
        {
          provide: 'REDIS_CONNECTION',
          useValue: { host: 'localhost', port: 6379 },
        },
      ],
    }).compile();

    service = module.get<CustomQuoteExpirationService>(
      CustomQuoteExpirationService,
    );
  });

  afterEach(async () => {

    await (
      service as unknown as { queue?: { close: () => Promise<void> } }
    ).queue?.close();
  });

  describe('processCleanup', () => {
    it('calls CustomQuotesService.expireOutdated', async () => {
      quotes.expireOutdated.mockResolvedValue({ count: 3 });

      await service.processCleanup();

      expect(quotes.expireOutdated).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when there are no quotes to expire', async () => {
      quotes.expireOutdated.mockResolvedValue({ count: 0 });

      await expect(service.processCleanup()).resolves.not.toThrow();
      expect(quotes.expireOutdated).toHaveBeenCalledTimes(1);
    });

    it('propagates error to BullMQ retry', async () => {

      quotes.expireOutdated.mockRejectedValue(new Error('db timeout'));

      await expect(service.processCleanup()).rejects.toThrow('db timeout');
    });
  });
});
