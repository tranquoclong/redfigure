import { Test, TestingModule } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { GoogleFeedService } from './google-feed.service';
import { MetaFeedService } from './meta-feed.service';

describe('FeedController', () => {
  let controller: FeedController;
  let googleFeed: { build: jest.Mock };
  let metaFeed: { build: jest.Mock };

  function mockResponse() {
    const res: any = {};
    res.type = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  }

  beforeEach(async () => {
    googleFeed = { build: jest.fn().mockResolvedValue('<rss>fake</rss>') };
    metaFeed = { build: jest.fn().mockResolvedValue('{"id":"1"}') };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedController],
      providers: [
        { provide: GoogleFeedService, useValue: googleFeed },
        { provide: MetaFeedService, useValue: metaFeed },
      ],
    }).compile();

    controller = module.get<FeedController>(FeedController);
  });

  describe('GET /feed/google', () => {
    it('returns XML body with application/xml content type', async () => {
      const res = mockResponse();
      await controller.google(res);

      expect(googleFeed.build).toHaveBeenCalledTimes(1);
      expect(res.type).toHaveBeenCalledWith('application/xml; charset=utf-8');
      expect(res.send).toHaveBeenCalledWith('<rss>fake</rss>');
    });
  });

  describe('GET /feed/meta', () => {
    it('returns JSONL body with application/x-ndjson content type', async () => {
      const res = mockResponse();
      await controller.meta(res);

      expect(metaFeed.build).toHaveBeenCalledTimes(1);
      expect(res.type).toHaveBeenCalledWith(
        'application/x-ndjson; charset=utf-8',
      );
      expect(res.send).toHaveBeenCalledWith('{"id":"1"}');
    });
  });
});
