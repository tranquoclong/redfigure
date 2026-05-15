import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface TrackBody {
  ref?: string;
  sessionId?: string;
  landingUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

@Public()
@Controller('api/v1/affiliates')
export class AffiliateTrackingController {
  constructor(private readonly tracking: AffiliateTrackingService) { }

  @Post('track')
  @Throttle({

    short: { limit: 10, ttl: 60_000 },
    long: { limit: 300, ttl: 3_600_000 },
  })
  async track(
    @Body() body: TrackBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-session-id') sessionIdHeader: string | undefined,
    @CurrentUser() user: { id: string } | null,
  ): Promise<void> {
    if (!body?.ref || typeof body.ref !== 'string') {
      res.status(204).end();
      return;
    }

    const result = await this.tracking.track({
      ref: body.ref,
      sessionId:
        (typeof body.sessionId === 'string' && body.sessionId.trim()) ||
        sessionIdHeader ||
        undefined,
      landingUrl: body.landingUrl ?? '/',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      userId: user?.id,
      utm: {
        source: body.utmSource,
        medium: body.utmMedium,
        campaign: body.utmCampaign,
        content: body.utmContent,
        term: body.utmTerm,
      },
    });

    if (result) {

      const isProd = process.env.NODE_ENV === 'production';
      const cookieName = isProd ? '__Host-redfigure_aff' : 'redfigure_aff';
      res.cookie(cookieName, String(result.publicId), {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: result.cookieMaxAgeSeconds * 1000,
      });
    }

    res.status(204).end();
  }
}
