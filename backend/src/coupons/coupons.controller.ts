import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return await this.couponsService.findAll();
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateCouponDto) {
    return await this.couponsService.create(dto);
  }

  @Public()
  @Post('validate')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 50, ttl: 3_600_000 },
  })
  async validate(
    @Body() dto: ValidateCouponDto,
    @CurrentUser() user: { id: string } | undefined,
  ) {
    return await this.couponsService.validate({
      code: dto.code,
      cartValue: dto.cartValue,
      userId: user?.id,
      appliedCouponIds: dto.appliedCouponIds,
    });
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateCouponDto>) {
    return await this.couponsService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.couponsService.remove(id);
    return { message: 'Coupon deactivated successfully' };
  }
}
