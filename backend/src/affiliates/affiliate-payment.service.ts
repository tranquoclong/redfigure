import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateLedgerService } from './affiliate-ledger.service';
import { SettingsService } from '../settings/settings.service';
import { EmailQueueService } from '../email/email-queue.service';
import { parseEmailRecipients } from '../common/utils/email-recipients';

@Injectable()
export class AffiliatePaymentService {
  private readonly logger = new Logger(AffiliatePaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: AffiliateLedgerService,
    private readonly settings: SettingsService,
    private readonly emailQueue: EmailQueueService,
  ) { }

  async requestPayment(affiliateId: string) {
    const existing = await this.prisma.affiliatePaymentRequest.findFirst({
      where: { affiliateId, status: 'PENDING' },
    });
    if (existing) {
      throw new ConflictException(
        'There is already a pending payment request. Please wait for the admin to process or cancel the existing one.',
      );
    }

    const balance = await this.ledger.currentBalance(affiliateId);
    const minPayoutRaw = await this.settings.get('affiliate_min_payout_amount');
    const minPayout = Number.isFinite(Number(minPayoutRaw))
      ? Number(minPayoutRaw)
      : 100;

    if (balance < minPayout) {
      throw new BadRequestException(
        `Insufficient balance. Minimum payout: ${minPayout.toFixed(2)}VND (current: ${balance.toFixed(2)}VND).`,
      );
    }

    const req = await this.prisma.affiliatePaymentRequest.create({
      data: {
        affiliateId,
        amountRequested: new Prisma.Decimal(balance),
        status: 'PENDING',
      },
    });

    const notify = await this.settings.get(
      'affiliate_notify_admin_new_payment_request',
    );
    if (notify !== 'false') {
      const account = await this.prisma.affiliateAccount.findUnique({
        where: { id: affiliateId },
        select: {
          publicId: true,
          user: { select: { name: true, email: true } },
        },
      });
      const recipients = await this.resolveAdminRecipients();
      for (const to of recipients) {
        void this.emailQueue
          .enqueueAffiliatePaymentRequestAdmin({
            to,
            affiliatePublicId: account?.publicId ?? 0,
            affiliateName: account?.user.name ?? account?.user.email ?? '—',
            amount: balance,
            requestId: req.id,
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Failed to enqueue payment request admin email: ${msg}`,
            );
          });
      }
    }

    return req;
  }

  async recordPayment(opts: {
    affiliateId: string;
    amount: number;
    paidAt: Date;
    note?: string;
    paymentRequestId?: string;
    createdByUserId: string;
  }) {
    if (!(opts.amount > 0)) {
      throw new BadRequestException('amount must be > 0');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      let requestSnapshot: {
        id: string;
        affiliateId: string;
        amountRequested: Prisma.Decimal;
        amountPaid: Prisma.Decimal;
        status: string;
      } | null = null;

      if (opts.paymentRequestId) {

        const locked = await tx.$queryRaw<
          Array<{
            id: string;
            affiliateId: string;
            amountRequested: string;
            amountPaid: string;
            status: string;
          }>
        >`
          SELECT id, "affiliateId", "amountRequested"::text AS "amountRequested",
                 "amountPaid"::text AS "amountPaid", status
          FROM "affiliate_payment_requests"
          WHERE id = ${opts.paymentRequestId}
          FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new NotFoundException('PaymentRequest not found');
        }
        const req = locked[0];
        if (req.affiliateId !== opts.affiliateId) {
          throw new BadRequestException(
            'PaymentRequest belongs to another affiliate.',
          );
        }
        if (req.status !== 'PENDING' && req.status !== 'PARTIALLY_PAID') {
          throw new ConflictException(
            `PaymentRequest is ${req.status}, no longer accepts payments.`,
          );
        }
        const currentPaid = new Prisma.Decimal(req.amountPaid);
        const requested = new Prisma.Decimal(req.amountRequested);
        const newAmountPaid = currentPaid.add(opts.amount);
        if (newAmountPaid.gt(requested)) {
          throw new BadRequestException(
            `Payment exceeds the requested amount (paid: ${req.amountPaid} + new: ${opts.amount} > requested: ${req.amountRequested}).`,
          );
        }
        requestSnapshot = {
          id: req.id,
          affiliateId: req.affiliateId,
          amountRequested: requested,
          amountPaid: currentPaid,
          status: req.status,
        };
      }

      const created = await tx.affiliatePayment.create({
        data: {
          affiliateId: opts.affiliateId,
          amount: new Prisma.Decimal(opts.amount),
          paidAt: opts.paidAt,
          note: opts.note,
          paymentRequestId: opts.paymentRequestId,
          createdByUserId: opts.createdByUserId,
        },
      });

      await this.ledger.appendDebitForPayment(
        {
          affiliateId: opts.affiliateId,
          amount: opts.amount,
          paymentId: created.id,
        },
        tx,
      );

      if (requestSnapshot) {
        const newPaid = requestSnapshot.amountPaid.add(opts.amount);
        const reached = newPaid.gte(requestSnapshot.amountRequested);
        await tx.affiliatePaymentRequest.update({
          where: { id: requestSnapshot.id },
          data: {
            amountPaid: newPaid,
            status: reached ? 'PAID' : 'PARTIALLY_PAID',
            ...(reached ? { completedAt: new Date() } : {}),
          },
        });
      }

      return created;
    });

    void this.notifyAffiliatePaid(opts.affiliateId, opts.amount, opts.note);

    return payment;
  }

  async cancelRequest(
    requestId: string,
    opts: {
      reason: string;
      cancelByUserId: string;

      byAffiliateId?: string;
    },
  ) {

    const res = await this.prisma.affiliatePaymentRequest.updateMany({
      where: {
        id: requestId,
        status: 'PENDING',
        ...(opts.byAffiliateId ? { affiliateId: opts.byAffiliateId } : {}),
      },
      data: {
        status: 'CANCELLED',
        cancelReason: opts.reason,
        cancelledAt: new Date(),
      },
    });

    if (res.count === 1) {
      return this.prisma.affiliatePaymentRequest.findUnique({
        where: { id: requestId },
      });
    }

    const current = await this.prisma.affiliatePaymentRequest.findUnique({
      where: { id: requestId },
      select: { affiliateId: true, status: true },
    });
    if (!current) throw new NotFoundException('PaymentRequest not found');
    if (opts.byAffiliateId && current.affiliateId !== opts.byAffiliateId) {
      throw new ForbiddenException('You cannot cancel this request');
    }
    throw new ConflictException(
      `Only PENDING can be cancelled. Current: ${current.status}.`,
    );
  }

  async listRequestsForAffiliate(affiliateId: string) {
    return this.prisma.affiliatePaymentRequest.findMany({
      where: { affiliateId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async listPendingRequests() {
    return this.prisma.affiliatePaymentRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { requestedAt: 'asc' },
      include: {
        affiliate: {
          select: {
            id: true,
            publicId: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
  }

  async listPaymentHistory(opts: { page?: number; perPage?: number }) {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.max(1, Math.min(opts.perPage ?? 50, 100));

    const [payments, total] = await Promise.all([
      this.prisma.affiliatePayment.findMany({
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          affiliate: {
            select: {
              id: true,
              publicId: true,
              user: { select: { name: true, email: true } },
            },
          },
          paymentRequest: {
            select: {
              id: true,
              amountRequested: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.affiliatePayment.count(),
    ]);

    return {
      data: payments.map((p) => ({
        id: p.id,
        amount: p.amount.toString(),
        note: p.note,
        paidAt: p.paidAt,
        createdByUserId: p.createdByUserId,
        affiliate: {
          id: p.affiliate.id,
          publicId: p.affiliate.publicId,
          name: p.affiliate.user.name,
          email: p.affiliate.user.email,
        },
        paymentRequest: p.paymentRequest
          ? {
            id: p.paymentRequest.id,
            amountRequested: p.paymentRequest.amountRequested.toString(),
            status: p.paymentRequest.status,
          }
          : null,
      })),
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }

  private async notifyAffiliatePaid(
    affiliateId: string,
    amount: number,
    note?: string,
  ) {
    try {
      const account = await this.prisma.affiliateAccount.findUnique({
        where: { id: affiliateId },
        select: {
          user: { select: { name: true, email: true } },
        },
      });
      if (!account?.user?.email) return;
      await this.emailQueue.enqueueAffiliatePaymentReceived({
        to: account.user.email,
        name: account.user.name ?? 'Affiliate',
        amount,
        note,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to enqueue affiliate payment received email: ${msg}`,
      );
    }
  }

  private async resolveAdminRecipients(): Promise<string[]> {
    const raw = await this.settings.get('low_stock_email_recipients');
    const parsed = parseEmailRecipients(raw);
    if (parsed.length > 0) return parsed;
    const fallback = process.env.ADMIN_EMAIL;
    if (fallback) return [fallback];
    return [];
  }
}
