import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Headers,
  Query,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
// import { CheckoutLogService } from '../payments/checkout-log.service';
import { AffiliateTrackingService } from '../affiliates/affiliate-tracking.service';
import { AffiliateCommissionService } from '../affiliates/affiliate-commission.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { TrackOrderDto } from './dto/track-order.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    // private readonly checkoutLog: CheckoutLogService,
    private readonly affiliateTracking: AffiliateTrackingService,
    private readonly affiliateCommission: AffiliateCommissionService,
  ) { }

  @Post()
  @Throttle({ checkout: { limit: 3, ttl: 60000 } })
  async create(
    @CurrentUser() user: { id: string; email?: string },
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request,
  ) {

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(idempotencyKey)) {
      throw new BadRequestException('Invalid Idempotency-Key format');
    }
    const start = Date.now();
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];

    const affCookie =
      req.cookies?.['__Host-redfigure_aff'] ?? req.cookies?.['redfigure_aff'];
    const sessionId = (req.headers['x-session-id'] as string) || undefined;
    const referringAffiliateId = affCookie
      ? await this.affiliateTracking
        .resolveReferringAffiliate(String(affCookie))
        .catch(() => null)
      : null;

    try {
      const result = await this.ordersService.createOrder({
        userId: user.id,
        userEmail: user.email,
        idempotencyKey,
        ...dto,
        referringAffiliateId,
        referringSessionId: sessionId,
      });

      if (referringAffiliateId && sessionId) {
        void this.affiliateTracking
          .markVisitConverted({
            affiliateId: referringAffiliateId,
            sessionId,
            orderId: result.id,
          })
          .catch((err) => {

            this.logger.error(
              `Failed to mark affiliate visit converted for order ${result.id}: ${(err as Error)?.message ?? err}`,
              (err as Error)?.stack,
            );
          });
      }

      //   step: 'create_order',
      //   status: 'success',
      //   orderId: result.id,
      //   userId: user.id,
      //   method: dto.paymentMethod,
      //   request: {
      //     items: dto.items,
      //     paymentMethod: dto.paymentMethod,
      //     shippingServiceName: dto.shippingServiceName,
      //     shippingServiceId: dto.shippingServiceId,
      //   },
      //   response: {
      //     orderId: result.id,
      //     number: result.number,
      //     subtotal: result.subtotal,
      //     total: result.total,
      //   },
      //   duration: Date.now() - start,
      //   ip,
      //   userAgent,
      // });

      return result;
    } catch (err) {
      // await this.checkoutLog.log({
      //   step: 'create_order',
      //   status: 'error',
      //   userId: user.id,
      //   method: dto.paymentMethod,
      //   request: { items: dto.items, paymentMethod: dto.paymentMethod },
      //   error: err,
      //   duration: Date.now() - start,
      //   ip,
      //   userAgent,
      // });
      throw err;
    }
  }

  @Get()
  async findAll(
    @CurrentUser() user: { id: string; role: string },
    @Query('page') page = '1',
    @Query('perPage') perPage = '10',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const userId = user.role === 'ADMIN' ? undefined : user.id;
    return await this.ordersService.findAll({
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
      userId,
      status,
      search,
    });
  }

  @Roles('ADMIN')
  @Get('trash')
  async findTrashed(
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
  ) {
    return await this.ordersService.findAllTrashed({
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
    });
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return await this.ordersService.findById(id, user);
  }

  @Roles('ADMIN')
  @Get(':id/commissions')
  async listCommissions(@Param('id') id: string) {
    const commissions = await this.affiliateCommission.listForOrder(id);
    const totalCommission = commissions.reduce(
      (sum, c) => sum + Number(c.commissionAmount),
      0,
    );
    return { data: commissions, meta: { totalCommission } };
  }

  @Roles('ADMIN')
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return await this.ordersService.updateStatus(
      id,
      dto.status,
      user.id,
      dto.reason,
      dto.acknowledgeRefundRequired ?? false,
    );
  }

  @Roles('ADMIN')
  @Delete(':id')
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return await this.ordersService.softDelete(id, user.id);
  }

  @Roles('ADMIN')
  @Post(':id/restore')
  async restore(@Param('id') id: string) {
    return await this.ordersService.restore(id);
  }

  @Public()
  @Post('track/:orderNumber')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  async track(
    @Param('orderNumber') orderNumber: string,
    @Body() body: TrackOrderDto,
  ) {
    return await this.ordersService.trackByNumber(orderNumber, body.email);
  }
}
