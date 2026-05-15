import { Controller, Get, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { GoogleFeedService } from './google-feed.service';
import { MetaFeedService } from './meta-feed.service';

@Public()
@Controller('feed')
@Throttle({ short: { limit: 60, ttl: 60000 } })
export class FeedController {
  constructor(
    private readonly googleFeed: GoogleFeedService,
    private readonly metaFeed: MetaFeedService,
  ) {}

  @Get('google')
  async google(@Res() res: Response): Promise<void> {
    const xml = await this.googleFeed.build();
    res.type('application/xml; charset=utf-8').send(xml);
  }

  @Get('meta')
  async meta(@Res() res: Response): Promise<void> {
    const jsonl = await this.metaFeed.build();
    res.type('application/x-ndjson; charset=utf-8').send(jsonl);
  }
}
