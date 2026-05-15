import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProductQuestionStatus } from '@prisma/client';
import { ProductQuestionsService } from './product-questions.service';
import { AnswerProductQuestionDto } from './dto/answer-product-question.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Roles('ADMIN')
@Controller('api/v1/admin/product-questions')
export class AdminProductQuestionsController {
  constructor(private readonly questions: ProductQuestionsService) { }

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('productId') productId?: string,
    @Query('page') pageRaw?: string,
    @Query('perPage') perPageRaw?: string,
  ) {

    let statusEnum: ProductQuestionStatus | undefined;
    if (status) {
      if (
        !Object.values(ProductQuestionStatus).includes(
          status as ProductQuestionStatus,
        )
      ) {
        throw new BadRequestException('Invalid status.');
      }
      statusEnum = status as ProductQuestionStatus;
    }

    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(perPageRaw ?? '20', 10) || 20),
    );

    return this.questions.findAllAdmin({
      status: statusEnum,
      productId,
      page,
      perPage,
    });
  }

  @Patch(':id/answer')
  async answer(
    @Param('id') id: string,
    @Body() dto: AnswerProductQuestionDto,
    @Req() req: Request,
  ) {
    const user = (req as unknown as { user?: { id: string } }).user;
    if (!user?.id) throw new BadRequestException('Admin not authenticated.');
    const result = await this.questions.answer(id, dto.answer, user.id);
    return { data: result };
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string) {
    const result = await this.questions.reject(id);
    return { data: result };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = (
      req as unknown as {
        user?: { id: string; role: 'ADMIN' | 'CUSTOMER' };
      }
    ).user;
    if (!user?.id || !user.role) {
      throw new BadRequestException('Admin not authenticated.');
    }

    await this.questions.delete(id, { id: user.id, role: user.role });
    return { data: { ok: true } };
  }

  @Get('pending-count')
  async pendingCount() {
    return { data: await this.questions.countPending() };
  }
}
