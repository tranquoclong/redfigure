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
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 60 * 60 * 1000 },
  })
  async submit(@Body() dto: CreateContactDto, @Req() req: Request) {
    const ipAddress =
      req.ip ??
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim();
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;

    const result = await this.contact.submit({
      name: dto.name,
      email: dto.email,
      message: dto.message,
      turnstileToken: dto.turnstileToken,
      acceptLgpd: dto.acceptLgpd,
      honeypot: dto.website,
      ipAddress: ipAddress ?? undefined,
      userAgent,
    });
    return { data: result };
  }
}
