import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeLedgerHash, LedgerHashInput } from './affiliate-ledger-hash';
import { uuidv7 } from './uuidv7';

@Injectable()
export class AffiliateLedgerService implements OnModuleInit {
  private readonly logger = new Logger(AffiliateLedgerService.name);
  private hmacSecret: string | null = null;

  constructor(private readonly prisma: PrismaService) { }

  onModuleInit() {
    const secret = process.env.AFFILIATE_LEDGER_HMAC_SECRET;
    const required = process.env.AFFILIATE_LEDGER_REQUIRE_HASH === 'true';

    if (secret && secret.length >= 32) {
      this.hmacSecret = secret;
      this.logger.log('Ledger hash chain ENABLED (HMAC-SHA256)');
      return;
    }

    if (required) {
      const msg =
        'AFFILIATE_LEDGER_REQUIRE_HASH=true but AFFILIATE_LEDGER_HMAC_SECRET not set (or <32 chars). Halting to avoid unsigned ledger.';
      this.logger.error(msg);
      throw new Error(msg);
    }

    this.hmacSecret = null;
    this.logger.warn(
      'AFFILIATE_LEDGER_HMAC_SECRET not set (or <32 chars) — ledger entries will be created without hash chain. Retroactive anti-tampering disabled. Set AFFILIATE_LEDGER_REQUIRE_HASH=true to force fail-closed in production.',
    );
  }

  async appendCreditForCommission(commissionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.affiliateCommission.updateMany({
        where: { id: commissionId, status: 'PENDING' },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      if (claim.count === 0) return;

      const c = await tx.affiliateCommission.findUnique({
        where: { id: commissionId },
        select: {
          affiliateId: true,
          orderId: true,
          commissionAmount: true,
        },
      });
      if (!c) return;

      if (Number(c.commissionAmount) <= 0) {
        throw new BadRequestException(
          `Invalid commissionAmount ${c.commissionAmount} in commission ${commissionId}`,
        );
      }

      await this.lockAffiliate(tx, c.affiliateId);
      await this.createWithHash(tx, {
        affiliateId: c.affiliateId,
        type: 'CREDIT',
        source: 'COMMISSION',
        amount: c.commissionAmount as Prisma.Decimal,
        orderId: c.orderId,
        commissionId,
      });
    });
  }

  async appendManualCredit(opts: {
    affiliateId: string;
    amount: number;
    reason: string;
    createdByUserId: string;
  }): Promise<void> {
    const reason = opts.reason?.trim();
    if (!reason) {
      throw new BadRequestException('reason required for MANUAL_CREDIT');
    }
    if (!(opts.amount > 0)) {
      throw new BadRequestException('amount must be > 0');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.lockAffiliate(tx, opts.affiliateId);
      await this.createWithHash(tx, {
        affiliateId: opts.affiliateId,
        type: 'CREDIT',
        source: 'MANUAL_CREDIT',
        amount: new Prisma.Decimal(opts.amount),
        reason,
        createdByUserId: opts.createdByUserId,
      });
    });
  }

  async appendAdjustment(opts: {
    affiliateId: string;
    type: 'CREDIT' | 'DEBIT';
    amount: number;
    reason: string;
    createdByUserId: string;
  }): Promise<void> {
    const reason = opts.reason?.trim();
    if (!reason) {
      throw new BadRequestException('reason required for ADJUSTMENT');
    }
    if (!(opts.amount > 0)) {
      throw new BadRequestException('amount must be > 0');
    }

    await this.prisma.$transaction(async (tx) => {

      if (opts.type === 'DEBIT') {
        const balance = await this.balanceForUpdate(tx, opts.affiliateId);
        if (balance < opts.amount) {
          throw new ConflictException(
            `Insufficient balance: available=${balance}, required=${opts.amount}`,
          );
        }
      } else {
        await this.lockAffiliate(tx, opts.affiliateId);
      }

      await this.createWithHash(tx, {
        affiliateId: opts.affiliateId,
        type: opts.type,
        source: 'ADJUSTMENT',
        amount: new Prisma.Decimal(opts.amount),
        reason,
        createdByUserId: opts.createdByUserId,
      });
    });
  }

  async appendDebitForPayment(
    opts: {
      affiliateId: string;
      amount: number;
      paymentId: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (!(opts.amount > 0)) {
      throw new BadRequestException('amount must be > 0');
    }

    const exec = async (tx: Prisma.TransactionClient) => {
      const balance = await this.balanceForUpdate(tx, opts.affiliateId);
      if (balance < opts.amount) {
        throw new ConflictException(
          `Insufficient balance: available=${balance}, required=${opts.amount}`,
        );
      }

      await this.createWithHash(tx, {
        affiliateId: opts.affiliateId,
        type: 'DEBIT',
        source: 'PAYMENT',
        amount: new Prisma.Decimal(opts.amount),
        paymentId: opts.paymentId,
      });
    };

    if (externalTx) {
      await exec(externalTx);
    } else {
      await this.prisma.$transaction(exec);
    }
  }

  async cancelPendingCommissionsForOrder(orderId: string): Promise<number> {
    const result = await this.prisma.affiliateCommission.updateMany({
      where: { orderId, status: 'PENDING' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Order cancelled',
      },
    });
    if (result.count > 0) {
      this.logger.log(
        `Cancelled ${result.count} PENDING commission(s) for order ${orderId}`,
      );
    }
    return result.count;
  }

  async currentBalance(affiliateId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ balance: string | null }[]>`
      SELECT COALESCE(SUM(CASE "type" WHEN 'CREDIT' THEN "amount" ELSE -"amount" END), 0)::text AS balance
      FROM "affiliate_ledger_entries"
      WHERE "affiliateId" = ${affiliateId}
    `;
    return parseBalance(rows);
  }

  private async balanceForUpdate(
    tx: Prisma.TransactionClient,
    affiliateId: string,
  ): Promise<number> {
    await this.lockAffiliate(tx, affiliateId);
    const rows = await tx.$queryRaw<{ balance: string | null }[]>`
      SELECT COALESCE(SUM(CASE "type" WHEN 'CREDIT' THEN "amount" ELSE -"amount" END), 0)::text AS balance
      FROM "affiliate_ledger_entries"
      WHERE "affiliateId" = ${affiliateId}
    `;
    return parseBalance(rows);
  }

  private async lockAffiliate(
    tx: Prisma.TransactionClient,
    affiliateId: string,
  ): Promise<void> {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "affiliate_accounts" WHERE id = ${affiliateId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new ConflictException(
        `Affiliate ${affiliateId} does not exist (append aborted)`,
      );
    }
  }

  private async createWithHash(
    tx: Prisma.TransactionClient,
    data: {
      affiliateId: string;
      type: 'CREDIT' | 'DEBIT';
      source: 'COMMISSION' | 'PAYMENT' | 'MANUAL_CREDIT' | 'ADJUSTMENT';
      amount: Prisma.Decimal;
      orderId?: string | null;
      commissionId?: string | null;
      paymentId?: string | null;
      reason?: string | null;
      createdByUserId?: string | null;
    },
  ): Promise<void> {

    const id = uuidv7();
    const createdAt = new Date();

    let prevHash: string | null = null;
    let hash: string | null = null;

    if (this.hmacSecret) {
      const prev = await tx.affiliateLedgerEntry.findFirst({
        where: { affiliateId: data.affiliateId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { hash: true },
      });
      prevHash = prev?.hash ?? null;

      const hashInput: LedgerHashInput = {
        id,
        affiliateId: data.affiliateId,
        type: data.type,
        source: data.source,
        amount: data.amount.toString(),
        orderId: data.orderId ?? null,
        commissionId: data.commissionId ?? null,
        paymentId: data.paymentId ?? null,
        reason: data.reason ?? null,
        createdByUserId: data.createdByUserId ?? null,
        createdAt,
      };
      hash = computeLedgerHash(hashInput, prevHash, this.hmacSecret);
    }

    await tx.affiliateLedgerEntry.create({
      data: {
        id,
        createdAt,
        affiliateId: data.affiliateId,
        type: data.type,
        source: data.source,
        amount: data.amount,
        orderId: data.orderId ?? undefined,
        commissionId: data.commissionId ?? undefined,
        paymentId: data.paymentId ?? undefined,
        reason: data.reason ?? undefined,
        createdByUserId: data.createdByUserId ?? undefined,
        prevHash,
        hash,
      },
    });

    if (this.hmacSecret && hash) {
      await tx.affiliateAccount.update({
        where: { id: data.affiliateId },
        data: { lastLedgerHash: hash, lastLedgerEntryId: id },
      });
    }
  }

  async listEntriesForAffiliate(
    affiliateId: string,
    opts: { page?: number; perPage?: number },
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.max(1, Math.min(opts.perPage ?? 50, 100));

    const [rows, total] = await Promise.all([
      this.prisma.affiliateLedgerEntry.findMany({
        where: { affiliateId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          type: true,
          source: true,
          amount: true,
          reason: true,
          createdAt: true,
          orderId: true,
          commissionId: true,
          paymentId: true,
          createdByUserId: true,
        },
      }),
      this.prisma.affiliateLedgerEntry.count({ where: { affiliateId } }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        type: r.type,
        source: r.source,
        amount: r.amount.toString(),
        reason: r.reason,
        createdAt: r.createdAt,
        orderId: r.orderId,
        commissionId: r.commissionId,
        paymentId: r.paymentId,
        createdByUserId: r.createdByUserId,
      })),
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }
}

function parseBalance(rows: { balance: string | null }[]): number {
  if (!rows.length) return 0;
  const raw = rows[0]?.balance;
  if (raw == null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
