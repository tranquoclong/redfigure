import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SubscribeInput {
  email: string;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ListInput {
  page: number;
  perPage: number;
  search?: string;
}

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(input: SubscribeInput): Promise<{ ok: true }> {
    const email = input.email.trim().toLowerCase();
    await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        source: input.source,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },

      update: {
        unsubscribedAt: null,
      },
    });
    return { ok: true };
  }

  async list(input: ListInput) {
    const { page, perPage, search } = input;
    const where: {
      unsubscribedAt: null;
      email?: { contains: string; mode: 'insensitive' };
    } = { unsubscribedAt: null };
    if (search && search.trim() !== '') {
      where.email = { contains: search.trim(), mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.newsletterSubscriber.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async stats(): Promise<{
    total: number;
    last24h: number;
    last7d: number;
    last30d: number;
  }> {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const baseWhere = { unsubscribedAt: null };

    const [total, last24h, last7d, last30d] = await Promise.all([
      this.prisma.newsletterSubscriber.count({ where: baseWhere }),
      this.prisma.newsletterSubscriber.count({
        where: { ...baseWhere, createdAt: { gte: new Date(now - day) } },
      }),
      this.prisma.newsletterSubscriber.count({
        where: { ...baseWhere, createdAt: { gte: new Date(now - 7 * day) } },
      }),
      this.prisma.newsletterSubscriber.count({
        where: { ...baseWhere, createdAt: { gte: new Date(now - 30 * day) } },
      }),
    ]);

    return { total, last24h, last7d, last30d };
  }

  async unsubscribe(id: string): Promise<void> {
    await this.prisma.newsletterSubscriber.update({
      where: { id },
      data: { unsubscribedAt: new Date() },
    });
  }

  async exportCsv(): Promise<string> {
    const rows = await this.prisma.newsletterSubscriber.findMany({
      where: { unsubscribedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { email: true, source: true, createdAt: true },
    });

    const header = 'email,source,created_at';
    const lines = rows.map((r) => {
      const email = csvEscape(r.email);
      const source = csvEscape(r.source ?? '');
      const created = r.createdAt.toISOString();
      return `${email},${source},${created}`;
    });
    return [header, ...lines].join('\n');
  }
}

function csvEscape(value: string): string {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
