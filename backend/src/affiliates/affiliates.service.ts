import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../email/email-queue.service';
import { SettingsService } from '../settings/settings.service';
import { ApplyAffiliateDto } from './dto/apply-affiliate.dto';

const CURRENT_TERMS_VERSION = 'v1';

function sanitizeEmailDisplayName(raw: string): string {

  const CONTROL_CHARS = /[\x00-\x1F\x7F<>]/g;
  const stripped = raw.replace(CONTROL_CHARS, '').trim().slice(0, 80);
  return stripped || '(usuario)';
}

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
    private readonly settings: SettingsService,
  ) { }

  async apply(userId: string, dto: ApplyAffiliateDto) {

    if (dto.acceptedTerms !== true) {
      throw new BadRequestException(
        'Terms were not accepted - acceptedTerms must be true',
      );
    }

    const enabled = await this.settings.get('affiliate_enabled');
    if (enabled !== 'true') {
      throw new ForbiddenException(
        'Affiliate program is currently disabled',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.affiliateAccount.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('You already have an affiliate account');
    }

    const now = new Date();
    let account;
    try {
      account = await this.prisma.affiliateAccount.create({
        data: {
          userId,
          status: 'APPROVED',
          termsAcceptedAt: now,
          termsVersion: CURRENT_TERMS_VERSION,
          approvedAt: now,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('You already have an affiliate account');
      }
      throw err;
    }

    const safeName = sanitizeEmailDisplayName(user.name ?? user.email);

    this.emailQueue
      .enqueueAffiliateWelcome({
        to: user.email,
        name: safeName,
        publicId: account.publicId,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to enqueue affiliate welcome email for user ${userId}: ${msg}`,
        );
      });

    return account;
  }

  async getMyAccount(userId: string) {
    return this.prisma.affiliateAccount.findUnique({
      where: { userId },
    });
  }

  async getById(id: string) {
    const account = await this.prisma.affiliateAccount.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!account) {
      throw new NotFoundException(`Affiliate ${id} not found`);
    }
    return account;
  }

  async updatePublicCode(id: string, rawCode: string | null | undefined) {
    const code =
      rawCode && rawCode.trim().length > 0
        ? rawCode.trim().toLowerCase()
        : null;
    try {
      return await this.prisma.affiliateAccount.update({
        where: { id },
        data: { publicCode: code },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(`Public code "${code}" is already in use`);
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(`Affiliate ${id} not found`);
      }
      throw err;
    }
  }

  async createForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    try {
      return await this.prisma.affiliateAccount.create({
        data: {
          userId: user.id,
          status: 'APPROVED',
          approvedAt: new Date(),
          termsAcceptedAt: new Date(),
          termsVersion: 'admin-created',
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `User ${user.email} already has an affiliate account`,
        );
      }
      throw err;
    }
  }

  async search(opts: {
    q?: string;
    status?: 'APPROVED' | 'PENDING' | 'SUSPENDED' | 'REJECTED';
    page?: number;
    perPage?: number;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.max(1, Math.min(opts.perPage ?? 20, 100));
    const q = opts.q?.trim();

    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    if (q) {
      where.user = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.affiliateAccount.findMany({
        where,
        select: {
          id: true,
          publicId: true,
          status: true,
          user: { select: { id: true, name: true, email: true } },
          createdAt: true,
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.affiliateAccount.count({ where }),
    ]);

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

  async exportAll(opts: {
    status?: 'APPROVED' | 'PENDING' | 'SUSPENDED' | 'REJECTED';
  }) {
    const MAX_EXPORT = 10_000;

    const statusFilter = opts.status
      ? Prisma.sql`WHERE aa.status::text = ${opts.status}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        publicId: number;
        name: string | null;
        email: string;
        status: string;
        createdAt: Date;
        balance: Prisma.Decimal;
        totalOrders: bigint;
      }>
    >`
      SELECT aa."publicId",
             u.name,
             u.email,
             aa.status,
             aa."createdAt",
             COALESCE((
               SELECT SUM(CASE le.type WHEN 'CREDIT' THEN le.amount ELSE -le.amount END)
               FROM "affiliate_ledger_entries" le
               WHERE le."affiliateId" = aa.id
             ), 0)::numeric AS balance,
             (
               SELECT COUNT(DISTINCT o.id)
               FROM "orders" o
               WHERE o."referringAffiliateId" = aa.id
             ) AS "totalOrders"
      FROM "affiliate_accounts" aa
      JOIN "users" u ON u.id = aa."userId"
      ${statusFilter}
      ORDER BY aa."createdAt" DESC
      LIMIT ${MAX_EXPORT}
    `;

    if (rows.length === MAX_EXPORT) {
      this.logger.warn(
        `exportAll truncated at ${MAX_EXPORT} rows. Consider pagination.`,
      );
    }

    return rows.map((r) => ({
      publicId: Number(r.publicId),
      name: r.name,
      email: r.email,
      status: r.status,
      createdAt: r.createdAt,
      balance: Number(r.balance),
      totalOrders: Number(r.totalOrders),
    }));
  }

  async suspend(
    affiliateId: string,
    opts: { reason: string; suspendedByUserId: string },
  ) {
    const existing = await this.prisma.affiliateAccount.findUnique({
      where: { id: affiliateId },
    });
    if (!existing) {
      throw new NotFoundException('Affiliate not found');
    }

    if (existing.status === 'SUSPENDED') {
      return existing;
    }

    const reason = opts.reason?.trim();
    if (!reason || reason.length < 5 || reason.length > 1000) {
      throw new BadRequestException('Reason required (5-1000 characters)');
    }

    return this.prisma.affiliateAccount.update({
      where: { id: affiliateId },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendedReason: reason,
        suspendedByUserId: opts.suspendedByUserId,
      },
    });
  }

  async reactivate(affiliateId: string) {
    const existing = await this.prisma.affiliateAccount.findUnique({
      where: { id: affiliateId },
    });
    if (!existing) {
      throw new NotFoundException('Affiliate not found');
    }
    if (existing.status === 'APPROVED') {
      return existing;
    }

    if (existing.status !== 'SUSPENDED') {
      throw new BadRequestException(
        `Cannot reactivate account with status ${existing.status}`,
      );
    }

    return this.prisma.affiliateAccount.update({
      where: { id: affiliateId },
      data: {
        status: 'APPROVED',
        suspendedAt: null,
        suspendedReason: null,
        suspendedByUserId: null,
      },
    });
  }
}
