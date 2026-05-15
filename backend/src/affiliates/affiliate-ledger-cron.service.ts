import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AffiliateLedgerService } from './affiliate-ledger.service';
import { AffiliateFraudDetectorService } from './affiliate-fraud-detector.service';
import { computeLedgerHash, LedgerHashInput } from './affiliate-ledger-hash';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureBullError } from '../observability/bullmq-error-capture';

const APPROVAL_JOB_ID = 'affiliate-ledger-approve-recurring';
const INVARIANT_JOB_ID = 'affiliate-ledger-invariant-recurring';
const FRAUD_SCAN_JOB_ID = 'affiliate-fraud-scan-recurring';
const CHAIN_CHECK_JOB_ID = 'affiliate-ledger-chain-check-recurring';

@Injectable()
export class AffiliateLedgerCronService
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AffiliateLedgerCronService.name);
  private queue: Queue | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly ledger: AffiliateLedgerService,
    private readonly fraudDetector: AffiliateFraudDetectorService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) { }

  async onModuleInit() {
    this.queue = new Queue(
      'affiliate-ledger',
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: { count: 30 },
          removeOnFail: { count: 30 },
        },
      }),
    );

    this.queue.on('error', (err) => {
      this.logger.error(`Queue error: ${err.message}`, err.stack);
      captureBullError(err, 'queue_error', 'affiliate-ledger');
    });

    try {
      await this.queue.add(
        'approve-pending-commissions',
        {},
        {
          repeat: { pattern: '0 2 * * *' },
          jobId: APPROVAL_JOB_ID,
        },
      );
      await this.queue.add(
        'invariant-check',
        {},
        {
          repeat: { pattern: '0 4 * * *' },
          jobId: INVARIANT_JOB_ID,
        },
      );
      await this.queue.add(
        'fraud-scan',
        {},
        {
          repeat: { pattern: '0 5 * * *' },
          jobId: FRAUD_SCAN_JOB_ID,
        },
      );
      await this.queue.add(
        'chain-check',
        {},
        {
          repeat: { pattern: '0 6 * * *' },
          jobId: CHAIN_CHECK_JOB_ID,
        },
      );
      this.logger.log(
        'Affiliate ledger crons scheduled (02:00 approval, 04:00 invariant, 05:00 fraud scan, 06:00 chain check)',
      );
    } catch (err) {
      this.logger.error(
        `Failed to schedule affiliate ledger crons: ${err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  async processApprovals(): Promise<void> {
    const raw = await this.settings.get('affiliate_hold_days_after_delivery');
    const holdDays = Number.isFinite(Number(raw)) ? Number(raw) : 7;
    const cutoff = new Date(Date.now() - holdDays * 86400_000);

    const BATCH_SIZE = 500;
    let lastId: string | undefined;
    let approved = 0;
    let seen = 0;

    for (; ;) {

      const candidates = await this.prisma.affiliateCommission.findMany({
        where: {
          status: 'PENDING',
          order: {
            status: 'DELIVERED',
            deliveredAt: { lte: cutoff },
          },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        select: { id: true },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
      });

      if (candidates.length === 0) break;
      seen += candidates.length;

      for (const c of candidates) {
        try {
          await this.ledger.appendCreditForCommission(c.id);
          approved++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Failed to approve commission ${c.id}: ${msg}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      }

      lastId = candidates[candidates.length - 1].id;
      if (candidates.length < BATCH_SIZE) break;
    }

    if (approved > 0) {
      this.logger.log(
        `Ledger approval cron: ${approved}/${seen} commission(s) approved`,
      );
    }
  }

  async processInvariantCheck(): Promise<void> {
    const rows = await this.prisma.$queryRaw<
      { affiliateId: string; balance: string }[]
    >`
      SELECT "affiliateId", COALESCE(SUM(CASE "type" WHEN 'CREDIT' THEN "amount" ELSE -"amount" END), 0)::text AS balance
      FROM "affiliate_ledger_entries"
      GROUP BY "affiliateId"
      HAVING COALESCE(SUM(CASE "type" WHEN 'CREDIT' THEN "amount" ELSE -"amount" END), 0) < 0
    `;

    if (rows.length === 0) {
      this.logger.log('Ledger invariant check: OK (no negative balances)');
      return;
    }

    for (const row of rows) {
      this.logger.error(
        `LEDGER INVARIANT VIOLATED — affiliateId=${row.affiliateId} balance=${row.balance} (saldo negativo nao deveria ocorrer). Investigar imediatamente.`,
      );
    }
  }

  async processFraudScan(): Promise<void> {
    const result = await this.fraudDetector.scanSuspiciousSessions();
    if (result.flaggedCount > 0) {
      this.logger.warn(
        `Fraud scan: ${result.flaggedCount} session(s) flagged for review.`,
      );
    } else {
      this.logger.log('Fraud scan: no suspicious sessions detected.');
    }
  }

  async processChainIntegrity(): Promise<void> {
    const secret = process.env.AFFILIATE_LEDGER_HMAC_SECRET;
    if (!secret || secret.length < 32) {
      this.logger.log(
        'Chain check skipped: AFFILIATE_LEDGER_HMAC_SECRET nao setado (modo legacy)',
      );
      return;
    }

    const affiliates = await this.prisma.affiliateAccount.findMany({
      where: { ledgerEntries: { some: {} } },
      select: { id: true, lastLedgerHash: true, lastLedgerEntryId: true },
    });

    let okCount = 0;
    let tamperedCount = 0;

    for (const aff of affiliates) {
      let lastHash: string | null = null;
      let lastEntryId: string | null = null;
      let cursor: string | null = null;
      let tamperedHere = false;

      for (; ;) {
        const batch = await this.fetchLedgerBatch(aff.id, cursor);
        if (batch.length === 0) break;

        for (const e of batch) {
          if (e.hash === null) {

            if (aff.lastLedgerHash !== null || lastHash !== null) {
              this.logger.error(
                `LEDGER CHAIN TAMPER: affiliateId=${aff.id} entryId=${e.id} hash=null em affiliate com hash chain ativo — possivel INSERT forjado na zona legacy ou DELETE/UPDATE no DB`,
              );
              tamperedHere = true;
            }
            lastHash = null;
            lastEntryId = e.id;
            continue;
          }

          if (e.prevHash !== lastHash) {
            this.logger.error(
              `LEDGER CHAIN BROKEN: affiliateId=${aff.id} entryId=${e.id} expected prevHash=${lastHash} got=${e.prevHash}`,
            );
            tamperedHere = true;
          }

          const input: LedgerHashInput = {
            id: e.id,
            affiliateId: e.affiliateId,
            type: e.type as 'CREDIT' | 'DEBIT',
            source: e.source,
            amount: (e.amount as unknown as { toString(): string }).toString(),
            orderId: e.orderId,
            commissionId: e.commissionId,
            paymentId: e.paymentId,
            reason: e.reason,
            createdByUserId: e.createdByUserId,
            createdAt: e.createdAt,
          };
          const expected = computeLedgerHash(input, e.prevHash, secret);
          if (expected !== e.hash) {
            this.logger.error(
              `LEDGER CHAIN TAMPER: affiliateId=${aff.id} entryId=${e.id} hash divergent — row editada pos-insert`,
            );
            tamperedHere = true;
          }

          lastHash = e.hash;
          lastEntryId = e.id;
        }
        cursor = batch[batch.length - 1].id;
        if (batch.length < 500) break;
      }

      if (
        aff.lastLedgerHash !== null &&
        (aff.lastLedgerHash !== lastHash ||
          aff.lastLedgerEntryId !== lastEntryId)
      ) {
        this.logger.error(
          `LEDGER TAIL TRUNCATED: affiliateId=${aff.id} expected tip=${aff.lastLedgerHash} (entry ${aff.lastLedgerEntryId}) got=${lastHash} (entry ${lastEntryId}) — rows do final foram deletadas direto no DB`,
        );
        tamperedHere = true;
      }

      if (tamperedHere) tamperedCount++;
      else okCount++;
    }

    if (tamperedCount > 0) {
      this.logger.error(
        `Chain integrity check: ${tamperedCount} affiliate(s) com tamper detectado. ${okCount} OK.`,
      );
    } else {
      this.logger.log(
        `Chain integrity check: OK (${okCount} affiliate(s) verificados).`,
      );
    }
  }

  private async fetchLedgerBatch(affiliateId: string, cursor: string | null) {
    if (cursor) {
      return this.prisma.affiliateLedgerEntry.findMany({
        where: { affiliateId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 500,
        skip: 1,
        cursor: { id: cursor },
        select: {
          id: true,
          affiliateId: true,
          type: true,
          source: true,
          amount: true,
          orderId: true,
          commissionId: true,
          paymentId: true,
          reason: true,
          createdByUserId: true,
          createdAt: true,
          hash: true,
          prevHash: true,
        },
      });
    }
    return this.prisma.affiliateLedgerEntry.findMany({
      where: { affiliateId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 500,
      select: {
        id: true,
        affiliateId: true,
        type: true,
        source: true,
        amount: true,
        orderId: true,
        commissionId: true,
        paymentId: true,
        reason: true,
        createdByUserId: true,
        createdAt: true,
        hash: true,
        prevHash: true,
      },
    });
  }
}
