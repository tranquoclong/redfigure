import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CommissionStatus } from '@prisma/client';
import { AffiliatesService } from './affiliates.service';
import { AffiliateStatsService } from './affiliate-stats.service';
import { AffiliatePaymentService } from './affiliate-payment.service';
import { AffiliateSettingsAuditService } from './affiliate-settings-audit.service';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { AffiliateCommissionService } from './affiliate-commission.service';
import { AffiliateLedgerService } from './affiliate-ledger.service';
import { LedgerAdjustmentDto } from './dto/ledger-adjustment.dto';
import { UpdatePublicCodeDto } from './dto/update-public-code.dto';
import { CreateAffiliateForUserDto } from './dto/create-affiliate-for-user.dto';
import { csvFromRows } from '../common/utils/csv';
import { SuspendAffiliateDto } from './dto/suspend-affiliate.dto';
import { SearchAffiliatesDto } from './dto/search-affiliates.dto';
import {
  StatsQueryDto,
  TimeSeriesQueryDto,
  TopsQueryDto,
} from './dto/stats-query.dto';
import {
  RecordPaymentDto,
  CancelPaymentRequestDto,
} from './dto/payment-request.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Roles('ADMIN')
@Controller('api/v1/admin/affiliates')
export class AdminAffiliatesController {
  constructor(
    private readonly affiliates: AffiliatesService,
    private readonly stats: AffiliateStatsService,
    private readonly paymentService: AffiliatePaymentService,
    private readonly settingsAudit: AffiliateSettingsAuditService,
    private readonly tracking: AffiliateTrackingService,
    private readonly commissions: AffiliateCommissionService,
    private readonly ledger: AffiliateLedgerService,
  ) { }

  @Get(':id/detail')
  async affiliateDetail(@Param('id') id: string) {
    const account = await this.affiliates.getById(id);
    const overview = await this.stats.getAffiliateOverview(id);
    return { data: { account, overview } };
  }

  @Get(':id/visits')
  async affiliateVisits(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
  ) {
    return this.tracking.listVisitsForAffiliate(id, { page, perPage });
  }

  @Get(':id/commissions')
  async affiliateCommissions(
    @Param('id') id: string,
    @Query('status') status: CommissionStatus | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
  ) {
    return this.commissions.listCommissionsForAffiliate(id, {
      page,
      perPage,
      status,
    });
  }

  @Get(':id/ledger')
  async affiliateLedger(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
  ) {
    return this.ledger.listEntriesForAffiliate(id, { page, perPage });
  }

  @Post(':id/public-code')
  async updatePublicCode(
    @Param('id') id: string,
    @Body() dto: UpdatePublicCodeDto,
  ) {
    const account = await this.affiliates.updatePublicCode(
      id,
      dto.publicCode ?? null,
    );
    return { data: account };
  }

  @Post('create-for-user')
  async createForUser(@Body() dto: CreateAffiliateForUserDto) {
    const account = await this.affiliates.createForUser(dto.userId);
    return { data: account };
  }

  @Post(':id/ledger-adjustment')
  async createLedgerAdjustment(
    @Param('id') affiliateId: string,
    @Body() dto: LedgerAdjustmentDto,
    @CurrentUser() admin: { id: string },
  ) {
    if (dto.type === 'CREDIT') {
      await this.ledger.appendManualCredit({
        affiliateId,
        amount: dto.amount,
        reason: dto.reason,
        createdByUserId: admin.id,
      });
    } else {
      await this.ledger.appendAdjustment({
        affiliateId,
        type: 'DEBIT',
        amount: dto.amount,
        reason: dto.reason,
        createdByUserId: admin.id,
      });
    }
    return { data: { ok: true } };
  }

  @Get('audit/default-rate')
  async defaultRateHistory(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
  ) {
    return this.settingsAudit.listDefaultRateHistory({ page, perPage });
  }

  @Get('stats')
  async getStats(@Query() query: StatsQueryDto) {
    const stats = await this.stats.getDashboardStats({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      affiliateId: query.affiliateId,
    });
    return { data: stats };
  }

  @Get('stats/timeseries')
  async getTimeSeries(@Query() query: TimeSeriesQueryDto) {
    const points = await this.stats.getCommissionTimeSeries({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      granularity: query.granularity ?? 'day',
      affiliateId: query.affiliateId,
    });
    return { data: points };
  }

  @Get('stats/top-products')
  async getTopProducts(@Query() query: TopsQueryDto) {
    const top = await this.stats.getTopProducts({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      limit: query.limit ?? 10,
      affiliateId: query.affiliateId,
    });
    return { data: top };
  }

  @Get('stats/top-affiliates')
  async getTopAffiliates(@Query() query: TopsQueryDto) {
    const top = await this.stats.getTopAffiliates({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      limit: query.limit ?? 10,
    });
    return { data: top };
  }

  @Get()
  async list(@Query() query: SearchAffiliatesDto) {
    return this.affiliates.search({
      q: query.q,
      status: query.status,
      page: query.page,
      perPage: query.perPage,
    });
  }

  @Post(':id/suspend')
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendAffiliateDto,
    @CurrentUser() admin: { id: string },
  ) {
    const account = await this.affiliates.suspend(id, {
      reason: dto.reason,
      suspendedByUserId: admin.id,
    });
    return { data: account };
  }

  @Post(':id/reactivate')
  async reactivate(@Param('id') id: string) {
    const account = await this.affiliates.reactivate(id);
    return { data: account };
  }

  @Get('payment-requests/pending')
  async listPendingRequests() {
    const data = await this.paymentService.listPendingRequests();
    return { data };
  }

  @Get('payment-requests/history')
  async listPaymentHistory(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
  ) {
    return this.paymentService.listPaymentHistory({ page, perPage });
  }

  @Post(':id/payments')
  async recordPayment(
    @Param('id') affiliateId: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() admin: { id: string },
  ) {
    const payment = await this.paymentService.recordPayment({
      affiliateId,
      amount: dto.amount,
      paidAt: new Date(dto.paidAt),
      note: dto.note,
      paymentRequestId: dto.paymentRequestId,
      createdByUserId: admin.id,
    });
    return { data: payment };
  }

  @Post('payment-requests/:requestId/cancel')
  async cancelPaymentRequest(
    @Param('requestId') requestId: string,
    @Body() dto: CancelPaymentRequestDto,
    @CurrentUser() admin: { id: string },
  ) {
    const data = await this.paymentService.cancelRequest(requestId, {
      reason: dto.reason,
      cancelByUserId: admin.id,
    });
    return { data };
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="affiliate-export.csv"')
  async exportCsv(
    @Query() query: SearchAffiliatesDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rows = await this.affiliates.exportAll({ status: query.status });
    const csv = csvFromRows(
      [
        'Public ID',
        'Name',
        'Email',
        'Status',
        'Registration date',
        'Balance (VND)',
        'Total orders',
      ],
      rows.map((r) => [
        r.publicId,
        r.name ?? '',
        r.email,
        r.status,
        r.createdAt.toISOString().split('T')[0],
        r.balance.toFixed(2),
        r.totalOrders,
      ]),
    );

    res.send(`\uFEFF${csv}`);
  }
}
