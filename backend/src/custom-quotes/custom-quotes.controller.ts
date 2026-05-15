import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CustomQuotesService } from './custom-quotes.service';
import { RequestCustomQuoteDto } from './dto/request-custom-quote.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MediaService } from '../media/media.service';

@Controller('api/v1/custom-quotes')
export class CustomQuotesController {
  constructor(
    private readonly quotes: CustomQuotesService,
    private readonly media: MediaService,
  ) { }

  @Public()
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 60 * 60 * 1000 },
  })
  async request(
    @Body() dto: RequestCustomQuoteDto,
    @Req() req: Request,

    @CurrentUser() user?: { id: string },
  ) {
    const ipAddress =
      req.ip ??
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      '';
    const result = await this.quotes.requestPublic(
      dto,
      ipAddress,
      user ? { id: user.id } : undefined,
    );
    return { data: result };
  }

  @Get('me')
  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  async findMine(
    @CurrentUser() user: { id: string },

    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
  ) {
    return this.quotes.findAllForUser(user.id, { page, perPage });
  }

  @Public()
  @Post('request/upload-image')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 60 * 60 * 1000 },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { data: null, error: 'Missing file' };
    }

    const media = await this.media.processAndUpload(
      file.buffer,
      file.originalname,
      file.mimetype,
      file.size,
      { stripMetadata: true },
    );
    return {
      data: {
        id: media.id,
        thumb: media.thumb,
        card: media.card,
      },
    };
  }

  @Public()
  @Get('token/:token')
  async findByToken(@Param('token') token: string) {
    const quote = await this.quotes.findByToken(token);
    return { data: quote };
  }
}
