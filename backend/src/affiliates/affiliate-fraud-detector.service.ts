import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AffiliateFraudDetectorService {
  private readonly logger = new Logger(AffiliateFraudDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async scanSuspiciousSessions(): Promise<{ flaggedCount: number }> {
    const rawThreshold = await this.settings.get(
      'affiliate_session_flag_threshold',
    );
    const n = Number(rawThreshold);
    const threshold = Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;

    const cutoff = new Date(Date.now() - 24 * 3600_000);

    const rows = await this.prisma.$queryRaw<
      {
        sessionId: string;
        affiliateId: string;
        conversions: bigint;
      }[]
    >`
      SELECT "sessionId", "affiliateId", COUNT(*) AS conversions
      FROM "affiliate_visits"
      WHERE "convertedOrderId" IS NOT NULL
        AND "convertedAt" >= ${cutoff}
        AND "sessionId" IS NOT NULL
      GROUP BY "sessionId", "affiliateId"
      HAVING COUNT(*) >= ${threshold}
      ORDER BY conversions DESC
      LIMIT 100
    `;

    for (const row of rows) {

      const safeSessionId = String(row.sessionId).replace(/[\r\n]+/g, ' ');
      const safeAffiliateId = String(row.affiliateId).replace(/[\r\n]+/g, ' ');
      this.logger.warn(
        `AFFILIATE_FRAUD_FLAG: sessionId=${safeSessionId} affiliateId=${safeAffiliateId} conversions=${row.conversions} last24h (threshold=${threshold}). Investigar self-buying fraud.`,
      );
    }

    return { flaggedCount: rows.length };
  }
}
