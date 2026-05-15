import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FreeGiftsService } from './free-gifts.service';
import { CreateFreeGiftDto } from './dto/create-free-gift.dto';
import { UpdateFreeGiftDto } from './dto/update-free-gift.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@Controller('api/v1/free-gifts')
export class FreeGiftsController {
  constructor(private readonly freeGifts: FreeGiftsService) { }

  @Public()
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  @Get('active')
  async getActive() {
    const gift = await this.freeGifts.getActiveGift();
    return { data: gift };
  }

  @Roles('ADMIN')
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  @Get()
  async findAll() {
    return this.freeGifts.findAll();
  }

  @Roles('ADMIN')
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  @Get(':id')
  async findById(@Param('id', ParseCuidPipe) id: string) {
    return this.freeGifts.findById(id);
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateFreeGiftDto) {
    return this.freeGifts.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateFreeGiftDto,
  ) {
    return this.freeGifts.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id', ParseCuidPipe) id: string) {
    await this.freeGifts.remove(id);
    return { message: 'Free gift removed' };
  }
}
