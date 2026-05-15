import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../redis/redis.service';

const LANDING_URL_MAX_LENGTH = 2000;
const USER_AGENT_MAX_LENGTH = 500;
const UTM_FIELD_MAX_LENGTH = 100;
const SESSION_ID_MAX_LENGTH = 100;

export interface TrackInput {
  ref: string;
  sessionId?: string;
  landingUrl: string;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
}

export interface TrackResult {
  affiliateId: string;
  publicId: number;

  cookieMaxAgeSeconds: number;
}

@Injectable()
export class AffiliateTrackingService {
  private readonly logger = new Logger(AffiliateTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly redis: RedisService,
  ) { }

  async track(input: TrackInput): Promise<TrackResult | null> {

    const enabled = await this.settings.get('affiliate_enabled');
    if (enabled !== 'true') {
      return null;
    }

    const publicId = this.parsePublicId(input.ref);
    const where: { publicId?: number; publicCode?: string } = {};
    if (publicId !== null) {
      where.publicId = publicId;
    } else {
      const code = this.parsePublicCode(input.ref);
      if (code === null) return null;
      where.publicCode = code;
    }

    const affiliate = await this.prisma.affiliateAccount.findUnique({
      where: where as { publicId: number } | { publicCode: string },
      select: { id: true, publicId: true, status: true },
    });
    if (!affiliate || affiliate.status !== 'APPROVED') {
      return null;
    }

    let shouldLogVisit = true;
    const dedupSeconds = parseInt(
      (await this.settings.get('affiliate_visit_dedup_seconds')) ?? '60',
      10,
    );
    const ttl =
      Number.isFinite(dedupSeconds) && dedupSeconds > 0 ? dedupSeconds : 60;

    if (input.sessionId) {
      const sessionKey = `aff:visit:${affiliate.id}:s:${input.sessionId.slice(0, SESSION_ID_MAX_LENGTH)}`;
      if (!(await this.redis.setNX(sessionKey, '1', ttl))) {
        shouldLogVisit = false;
      }
    }
    if (shouldLogVisit && input.ipAddress) {

      const ipKey = `aff:visit:${affiliate.id}:ip:${this.hashIpForDedup(input.ipAddress)}`;
      if (!(await this.redis.setNX(ipKey, '1', ttl))) {
        shouldLogVisit = false;
      }
    }

    if (shouldLogVisit) {
      const logIp = (await this.settings.get('affiliate_log_ip')) === 'true';
      const ipHash =
        logIp && input.ipAddress ? this.hashIp(input.ipAddress) : null;

      try {
        await this.prisma.affiliateVisit.create({
          data: {
            affiliateId: affiliate.id,
            sessionId: input.sessionId?.slice(0, SESSION_ID_MAX_LENGTH) ?? null,
            userId: input.userId ?? null,
            ipHash,
            userAgent: input.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
            landingUrl: input.landingUrl.slice(0, LANDING_URL_MAX_LENGTH),
            utmSource:
              input.utm?.source?.slice(0, UTM_FIELD_MAX_LENGTH) ?? null,
            utmMedium:
              input.utm?.medium?.slice(0, UTM_FIELD_MAX_LENGTH) ?? null,
            utmCampaign:
              input.utm?.campaign?.slice(0, UTM_FIELD_MAX_LENGTH) ?? null,
            utmContent:
              input.utm?.content?.slice(0, UTM_FIELD_MAX_LENGTH) ?? null,
            utmTerm: input.utm?.term?.slice(0, UTM_FIELD_MAX_LENGTH) ?? null,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to log affiliate visit for ${affiliate.id}: ${msg}`,
        );
      }
    }

    const cookieDays = parseInt(
      (await this.settings.get('affiliate_cookie_days')) ?? '30',
      10,
    );
    const days =
      Number.isFinite(cookieDays) && cookieDays > 0 ? cookieDays : 30;
    return {
      affiliateId: affiliate.id,
      publicId: affiliate.publicId,
      cookieMaxAgeSeconds: days * 86400,
    };
  }

  async resolveReferringAffiliate(cookieValue: string): Promise<string | null> {
    const publicId = this.parsePublicId(cookieValue);
    if (publicId === null) return null;

    const affiliate = await this.prisma.affiliateAccount.findUnique({
      where: { publicId },
      select: { id: true, status: true },
    });
    if (!affiliate || affiliate.status !== 'APPROVED') return null;
    return affiliate.id;
  }

  async markVisitConverted(opts: {
    affiliateId: string;
    sessionId: string;
    orderId: string;
  }) {
    await this.prisma.affiliateVisit.updateMany({
      where: {
        affiliateId: opts.affiliateId,
        sessionId: opts.sessionId,
        convertedOrderId: null,
      },
      data: {
        convertedOrderId: opts.orderId,
        convertedAt: new Date(),
      },
    });
  }

  async listVisitsForAffiliate(
    affiliateId: string,
    opts: { page?: number; perPage?: number },
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.max(1, Math.min(opts.perPage ?? 50, 100));

    const [rows, total] = await Promise.all([
      this.prisma.affiliateVisit.findMany({
        where: { affiliateId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          createdAt: true,
          landingUrl: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          utmTerm: true,
          userAgent: true,
          convertedOrderId: true,
          convertedAt: true,
        },
      }),
      this.prisma.affiliateVisit.count({ where: { affiliateId } }),
    ]);

    const orderIds = rows
      .map((r) => r.convertedOrderId)
      .filter((id): id is string => !!id);
    const orders = orderIds.length
      ? await this.prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, number: true },
      })
      : [];
    const orderMap = new Map(orders.map((o) => [o.id, o.number]));

    const data = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      landingUrl: r.landingUrl,
      utmSource: r.utmSource,
      utmMedium: r.utmMedium,
      utmCampaign: r.utmCampaign,
      utmContent: r.utmContent,
      utmTerm: r.utmTerm,
      userAgent: r.userAgent,
      converted: !!r.convertedOrderId,
      orderNumber: r.convertedOrderId
        ? (orderMap.get(r.convertedOrderId) ?? null)
        : null,
      convertedAt: r.convertedAt,
    }));

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async pruneOldVisits(): Promise<number> {
    const days = parseInt(
      (await this.settings.get('affiliate_visit_retention_days')) ?? '30',
      10,
    );
    const retentionDays = Number.isFinite(days) && days > 0 ? days : 30;
    const cutoff = new Date(Date.now() - retentionDays * 86400 * 1000);

    const result = await this.prisma.affiliateVisit.deleteMany({
      where: {
        convertedOrderId: null,
        createdAt: { lt: cutoff },
      },
    });
    return result.count;
  }

  private parsePublicId(raw: string | undefined | null): number | null {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 2_147_483_647) return null;
    return n;
  }

  private parsePublicCode(raw: string | undefined | null): string | null {
    if (!raw) return null;
    const trimmed = String(raw).trim().toLowerCase();
    if (trimmed.length < 3 || trimmed.length > 32) return null;
    if (/^\d+$/.test(trimmed)) return null;
    if (!/^[a-z0-9_-]+$/.test(trimmed)) return null;
    return trimmed;
  }

  private hashIp(ip: string): string | null {
    const salt = process.env.AFFILIATE_IP_HASH_SALT;
    if (!salt) {
      this.logger.warn(
        'AFFILIATE_IP_HASH_SALT Not configured — ipHash returns null',
      );
      return null;
    }
    return createHash('sha256')
      .update(ip + salt)
      .digest('hex');
  }

  private hashIpForDedup(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').slice(0, 16);
  }
}
