import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ReviewInvitesService } from './review-invites.service';
import { MediaService } from '../media/media.service';
import { SettingsService } from '../settings/settings.service';
import { SubmitReviewDto } from './dto/submit-review.dto';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('review-invites')
export class ReviewInvitesController {
  constructor(
    private readonly service: ReviewInvitesService,
    private readonly media: MediaService,
    private readonly settings: SettingsService,
  ) { }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get(':token')
  async findByToken(@Param('token') token: string) {
    return { data: await this.service.findByToken(token) };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post(':token/submit')
  @HttpCode(200)
  async submit(@Param('token') token: string, @Body() dto: SubmitReviewDto) {
    return { data: await this.service.submit(token, dto) };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post(':token/photos')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async uploadPhotos(
    @Param('token') token: string,
    @UploadedFiles()
    files: Array<{
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    }>,
  ) {

    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestException('No photo uploaded');
    }

    await this.service.findByToken(token);

    const cfg = await this.settings.getReviewSettings();
    if (files.length > cfg.maxPhotos) {
      throw new BadRequestException(
        `Maximum of ${cfg.maxPhotos} photos per review`,
      );
    }
    const maxBytes = cfg.maxPhotoSizeMb * 1024 * 1024;
    for (const f of files) {
      if (f.size > maxBytes) {
        throw new BadRequestException(
          `File "${f.originalname}" exceeds ${cfg.maxPhotoSizeMb}MB`,
        );
      }
    }

    const media = await Promise.all(
      files.map((f) =>
        this.media.processAndUpload(
          f.buffer,
          f.originalname,
          f.mimetype,
          f.size,
          {
            stripMetadata: true,
          },
        ),
      ),
    );

    return {
      data: media.map((m) => ({
        id: m.id,
        card: (m as any).card,
        full: (m as any).full,
      })),
    };
  }
}
