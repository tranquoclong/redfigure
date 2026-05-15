import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CustomQuotesService } from './custom-quotes.service';
import { CreateCustomQuoteDto } from './dto/create-custom-quote.dto';
import { UpdateCustomQuoteDto } from './dto/update-custom-quote.dto';
import { CreateQuoteItemDto } from './dto/create-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';
import { AttachImagesDto } from './dto/attach-images.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Roles('ADMIN')
@Controller('api/v1/admin/custom-quotes')
export class AdminCustomQuotesController {
  constructor(private readonly quotes: CustomQuotesService) {}

  @Get('pending-count')
  async pendingCount() {
    const count = await this.quotes.countPendingRequested();
    return { data: { count } };
  }

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('page') pageRaw?: string,
    @Query('perPage') perPageRaw?: string,
  ) {
    const page = Math.min(1000, Math.max(1, parseInt(pageRaw ?? '1', 10) || 1));
    const perPage = Math.max(
      1,
      Math.min(100, parseInt(perPageRaw ?? '20', 10) || 20),
    );
    return this.quotes.findAllAdmin({ status, page, perPage });
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const quote = await this.quotes.findByIdAdmin(id);
    return { data: quote };
  }

  @Post()
  async create(@Body() dto: CreateCustomQuoteDto) {
    const quote = await this.quotes.createAdmin(dto);
    return { data: quote };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomQuoteDto) {
    const quote = await this.quotes.updateAdmin(id, dto);
    return { data: quote };
  }

  @Post(':id/items')
  async addItem(@Param('id') id: string, @Body() dto: CreateQuoteItemDto) {
    const item = await this.quotes.addItem(id, dto);
    return { data: item };
  }

  @Patch(':id/items/:itemId')
  async updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQuoteItemDto,
  ) {
    const item = await this.quotes.updateItem(itemId, dto);
    return { data: item };
  }

  @Delete(':id/items/:itemId')
  async deleteItem(@Param('itemId') itemId: string) {
    await this.quotes.deleteItem(itemId);
    return { data: { ok: true } };
  }

  @Post(':id/images')
  async attachImages(@Param('id') id: string, @Body() dto: AttachImagesDto) {
    const result = await this.quotes.attachImages(
      id,
      dto.mediaFileIds,
      'ADMIN',
    );
    return { data: result };
  }

  @Post(':id/send')
  async send(@Param('id') id: string) {
    const quote = await this.quotes.send(id);
    return { data: quote };
  }

  @Post(':id/resend-email')
  async resendEmail(@Param('id') id: string) {
    const result = await this.quotes.resendEmail(id);
    return { data: result };
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    const quote = await this.quotes.cancel(id);
    return { data: quote };
  }
}
