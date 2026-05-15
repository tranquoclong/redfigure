import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  ProductQuestionsService,
  AskAuthUser,
} from './product-questions.service';
import { CreateProductQuestionDto } from './dto/create-product-question.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1')
export class PublicProductQuestionsController {
  constructor(private readonly questions: ProductQuestionsService) { }

  @Public()
  @Post('product-questions')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 60 * 60 * 1000 },
  })
  async ask(@Body() dto: CreateProductQuestionDto, @Req() req: Request) {
    const ipAddress =
      req.ip ??
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim();
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;

    const user: AskAuthUser | null =
      (req as unknown as { user?: AskAuthUser }).user ?? null;

    const result = await this.questions.ask(
      {
        productId: dto.productId,
        question: dto.question,
        acceptLgpd: dto.acceptLgpd,
        askerName: dto.askerName,
        askerEmail: dto.askerEmail,
        turnstileToken: dto.turnstileToken,
        website: dto.website,
      },
      user,
      { ipAddress: ipAddress ?? undefined, userAgent },
    );
    return { data: result };
  }

  @Public()
  @Get('products/:productId/questions')
  async list(
    @Param('productId') productId: string,
    @Req() req: Request,
    @Query('page') pageRaw?: string,
    @Query('perPage') perPageRaw?: string,
  ) {

    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const perPage = Math.min(
      50,
      Math.max(1, parseInt(perPageRaw ?? '10', 10) || 10),
    );

    const currentUserId = (req as unknown as { user?: { id: string } }).user
      ?.id;
    return this.questions.findPublicByProduct(
      productId,
      page,
      perPage,
      currentUserId,
    );
  }

  @Delete('product-questions/:id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = (
      req as unknown as {
        user?: { id: string; role: 'ADMIN' | 'CUSTOMER' };
      }
    ).user;
    if (!user?.id) {
      throw new BadRequestException('Authentication required to delete.');
    }
    await this.questions.delete(id, { id: user.id, role: user.role });
    return { data: { ok: true } };
  }
}
