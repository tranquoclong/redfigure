import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { NewsletterService } from './newsletter.service';
import { Public } from '../common/decorators/public.decorator';
import { SubscribeDto } from './dto/subscribe.dto';

@Controller('api/v1/newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Public()
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 10, ttl: 60_000 } })
  async subscribe(@Body() dto: SubscribeDto, @Req() req: Request) {
    const ipAddress =
      req.ip ??
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim();
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;

    const result = await this.newsletter.subscribe({
      email: dto.email,
      source: dto.source,
      ipAddress: ipAddress ?? undefined,
      userAgent,
    });
    return { data: result };
  }
}
