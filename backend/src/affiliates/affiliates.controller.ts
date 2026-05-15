import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CommissionStatus } from '@prisma/client';
import { AffiliatesService } from './affiliates.service';
import { AffiliateStatsService } from './affiliate-stats.service';
import { AffiliatePaymentService } from './affiliate-payment.service';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { AffiliateCommissionService } from './affiliate-commission.service';
import { AffiliateLedgerService } from './affiliate-ledger.service';
import { ApplyAffiliateDto } from './dto/apply-affiliate.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/me/affiliate')
export class AffiliatesController {
  constructor(
    private readonly affiliates: AffiliatesService,
    private readonly stats: AffiliateStatsService,
    private readonly payments: AffiliatePaymentService,
    private readonly tracking: AffiliateTrackingService,
    private readonly commissions: AffiliateCommissionService,
    private readonly ledger: AffiliateLedgerService,
  ) { }

  @Get('commissions')
  async listMyCommissions(
    @CurrentUser() user: { id: string },
    @Query('status') status: CommissionStatus | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
  ) {
    const account = await this.affiliates.getMyAccount(user.id);
    if (!account) throw new NotFoundException('User is not an affiliate');
    return this.commissions.listCommissionsForAffiliate(account.id, {
      page,
      perPage,
      status,
    });
  }

  @Get('ledger')
  async listMyLedger(
    @CurrentUser() user: { id: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
  ) {
    const account = await this.affiliates.getMyAccount(user.id);
    if (!account) throw new NotFoundException('User is not an affiliate');
    return this.ledger.listEntriesForAffiliate(account.id, { page, perPage });
  }

  @Get('visits')
  async listMyVisits(
    @CurrentUser() user: { id: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
  ) {
    const account = await this.affiliates.getMyAccount(user.id);
    if (!account) throw new NotFoundException('User is not an affiliate');
    return this.tracking.listVisitsForAffiliate(account.id, { page, perPage });
  }

  @Get('stats/overview')
  async getMyOverview(@CurrentUser() user: { id: string }) {
    const account = await this.affiliates.getMyAccount(user.id);
    if (!account) {
      throw new NotFoundException('User is not an affiliate');
    }
    const overview = await this.stats.getAffiliateOverview(account.id);
    return { data: overview };
  }

  @Get()
  async getMine(@CurrentUser() user: { id: string }) {
    const account = await this.affiliates.getMyAccount(user.id);
    return { data: account };
  }

  @Post('apply')
  @Throttle({ short: { limit: 3, ttl: 60_000 } })
  async apply(
    @CurrentUser() user: { id: string },
    @Body() dto: ApplyAffiliateDto,
  ) {
    const account = await this.affiliates.apply(user.id, dto);
    return { data: account };
  }

  @Get('payment-requests')
  async listMyRequests(@CurrentUser() user: { id: string }) {
    const account = await this.affiliates.getMyAccount(user.id);
    if (!account) throw new NotFoundException('User is not an affiliate');
    const data = await this.payments.listRequestsForAffiliate(account.id);
    return { data };
  }

  @Post('payment-requests')
  @Throttle({ short: { limit: 3, ttl: 60_000 } })
  async createMyRequest(@CurrentUser() user: { id: string }) {
    const account = await this.affiliates.getMyAccount(user.id);
    if (!account) throw new NotFoundException('User is not an affiliate');
    const data = await this.payments.requestPayment(account.id);
    return { data };
  }

  @Delete('payment-requests/:id')
  async cancelMyRequest(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    const account = await this.affiliates.getMyAccount(user.id);
    if (!account) throw new NotFoundException('User is not an affiliate');
    const data = await this.payments.cancelRequest(id, {
      reason: 'Cancelled by affiliate',
      cancelByUserId: user.id,
      byAffiliateId: account.id,
    });
    return { data };
  }
}
