import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../email/email-queue.service';
import { TurnstileService } from '../turnstile/turnstile.service';
import { SettingsService } from '../settings/settings.service';
import { parseEmailRecipients } from '../common/utils/email-recipients';
import { RequestCustomQuoteDto } from './dto/request-custom-quote.dto';
import { captureFailOpen } from '../observability/fail-open-capture';
import { CreateCustomQuoteDto } from './dto/create-custom-quote.dto';
import { UpdateCustomQuoteDto } from './dto/update-custom-quote.dto';
import { CreateQuoteItemDto } from './dto/create-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';

const PENDING_STATUSES_FOR_ACCEPT = new Set(['SENT', 'PARTIALLY_ACCEPTED']);

@Injectable()
export class CustomQuotesService {
  private readonly logger = new Logger(CustomQuotesService.name);

  constructor(
    private prisma: PrismaService,
    private emailQueue: EmailQueueService,
    private turnstile: TurnstileService,
    private settings: SettingsService,
    private configService: ConfigService,
  ) { }

  private async resolveAdminRecipients(): Promise<string[]> {
    const csv = await this.settings.get('low_stock_email_recipients');
    const fromDb = parseEmailRecipients(csv);
    if (fromDb.length > 0) return fromDb;
    return parseEmailRecipients(
      this.configService.get<string>('ADMIN_EMAIL') ?? null,
    );
  }

  private assertFiniteNumber(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`Field "${field}" invalid`);
    }
    return value;
  }

  private sanitizeUrls(urls: string[]): string[] {
    const out: string[] = [];
    for (const raw of urls) {
      try {
        const parsed = new URL(raw.trim());
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          out.push(parsed.toString());
        }
      } catch {

      }
    }
    return out;
  }

  private async generateNumber(): Promise<string> {

    for (let attempt = 0; attempt < 10; attempt++) {
      const bytes = attempt < 5 ? 6 : 9;
      const num = `ORC-${randomBytes(bytes).toString('hex').toUpperCase()}`;
      const exists = await this.prisma.customQuote.findUnique({
        where: { number: num },
        select: { id: true },
      });
      if (!exists) return num;
    }
    throw new Error('Could not generate unique quote number after 10 tries');
  }

  private generateToken(): string {

    return randomBytes(32).toString('hex');
  }

  private async getValidityDays(override?: number): Promise<number> {
    if (override && override > 0) return override;
    const raw = await this.settings.get('custom_quote_validity_days');
    const parsed = parseInt(raw ?? '14', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
  }

  private expiresAtFromNow(days: number): Date {
    return new Date(Date.now() + days * 86_400_000);
  }

  async requestPublic(
    dto: RequestCustomQuoteDto,
    ipAddress: string,
    caller?: { id: string },
  ) {

    if (dto.website && dto.website.length > 0) {
      this.logger.warn(
        `Honeypot tripped on quote request from ip=${this.sanitizeLog(ipAddress)}`,
      );
      return { ok: true };
    }

    if (dto.acceptLgpd !== true) {
      throw new BadRequestException(
        'You must accept the processing of data (LGPD)',
      );
    }

    const turnstileOk = await this.turnstile.verify(
      dto.turnstileToken,
      ipAddress,
    );
    if (!turnstileOk) {
      throw new BadRequestException(
        'Security verification failed. Reload the page and try again.',
      );
    }

    let name: string;
    let email: string;
    let phone: string | null;
    let userId: string | null;

    if (caller) {
      const user = await this.prisma.user.findUnique({
        where: { id: caller.id },
        select: { id: true, name: true, email: true, phone: true },
      });
      if (!user) {

        throw new BadRequestException('Invalid session. Please log in again.');
      }
      userId = user.id;

      name = user.name ?? user.email.split('@')[0] ?? 'Client';
      email = user.email;
      phone = user.phone ?? null;
    } else {

      if (!dto.name || !dto.email) {
        throw new BadRequestException(
          'Name and email are required to request a quote without login.',
        );
      }
      name = dto.name.trim();
      email = dto.email.trim().toLowerCase();
      phone = dto.phone?.trim() || null;

      userId = null;
    }

    const number = await this.generateNumber();
    const token = this.generateToken();
    const validityDays = await this.getValidityDays();

    const quote = await this.prisma.customQuote.create({
      data: {
        number,
        token,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        userId,
        customerNotes: dto.description.trim(),
        externalLinks: this.sanitizeUrls(dto.externalLinks ?? []),
        status: 'REQUESTED',
        expiresAt: this.expiresAtFromNow(validityDays),
        ...(dto.imageMediaFileIds?.length && {
          images: {
            create: dto.imageMediaFileIds.map((mediaFileId, i) => ({
              mediaFileId,
              uploadedBy: 'CUSTOMER',
              order: i,
            })),
          },
        }),
      },
    });

    const adminTo = await this.resolveAdminRecipients();
    if (adminTo.length === 0) {
      this.logger.error(
        'No admin recipient configured (setting low_stock_email_recipients empty + ADMIN_EMAIL env empty) — quote created but no notification',
      );
    } else {
      await this.emailQueue
        .enqueueCustomQuoteRequestAdmin({
          to: adminTo,
          quoteNumber: number,
          quoteId: quote.id,
          customerName: name,
          customerEmail: email,
          customerPhone: dto.phone?.trim() || undefined,
          description: dto.description.trim(),
          externalLinks: this.sanitizeUrls(dto.externalLinks ?? []),
        })
        .catch((err) => {
          this.logger.error(`Failed to enqueue admin email: ${err.message}`);
          captureFailOpen(err, 'custom_quote_email_admin_enqueue', { number });
        });
    }

    return { ok: true, number };
  }

  async findByToken(token: string) {
    const quote = await this.prisma.customQuote.findUnique({
      where: { token },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          include: { mediaFile: true },

          orderBy: { order: 'asc' },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'EXPIRED' || quote.expiresAt < new Date()) {
      throw new BadRequestException('This quote has expired');
    }

    if (quote.status === 'CANCELLED') {
      throw new BadRequestException('This quote has been canceled');
    }

    if (
      !PENDING_STATUSES_FOR_ACCEPT.has(quote.status) &&
      quote.status !== 'FULLY_ACCEPTED'
    ) {

      throw new BadRequestException('Quote not available yet');
    }

    const { customerEmail, userId, adminNotes, ...safe } = quote;
    void customerEmail;
    void userId;
    void adminNotes;
    return safe;
  }

  async findAllForUser(
    userId: string,
    params: { page?: number; perPage?: number },
  ) {
    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.min(100, Math.max(1, params.perPage ?? 20));
    const skip = (page - 1) * perPage;

    const where = { userId };

    const [rows, total] = await Promise.all([
      this.prisma.customQuote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: perPage,
        skip,
        select: {
          id: true,
          number: true,
          status: true,
          token: true,
          expiresAt: true,
          sentAt: true,
          acceptedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.customQuote.count({ where }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      token: r.token,
      expiresAt: r.expiresAt,
      sentAt: r.sentAt,
      acceptedAt: r.acceptedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      itemsCount: r._count.items,
    }));

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

  async createAdmin(dto: CreateCustomQuoteDto) {
    const email = dto.customerEmail.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const number = await this.generateNumber();
    const token = this.generateToken();
    const validityDays = await this.getValidityDays(dto.validityDays);

    const quote = await this.prisma.customQuote.create({
      data: {
        number,
        token,
        customerName: dto.customerName.trim(),
        customerEmail: email,
        customerPhone: dto.customerPhone?.trim() || null,
        userId: existingUser?.id ?? null,
        customerNotes: dto.customerNotes?.trim() || null,
        adminNotes: dto.adminNotes?.trim() || null,
        externalLinks: this.sanitizeUrls(dto.externalLinks ?? []),
        status: 'DRAFT',
        expiresAt: this.expiresAtFromNow(validityDays),
        ...(dto.items?.length && {
          items: {
            create: dto.items.map((it, i) => ({
              name: it.name.trim(),
              description: it.description?.trim() || null,
              unitPrice: this.assertFiniteNumber(it.unitPrice, 'unitPrice'),
              maxQuantity: it.maxQuantity ?? 1,
              weight: this.assertFiniteNumber(it.weight, 'weight'),
              width: this.assertFiniteNumber(it.width, 'width'),
              height: this.assertFiniteNumber(it.height, 'height'),
              length: this.assertFiniteNumber(it.lengthCm, 'lengthCm'),
              sortOrder: it.sortOrder ?? i,
            })),
          },
        }),
      },
    });

    return quote;
  }

  async updateAdmin(id: string, dto: UpdateCustomQuoteDto) {
    const existing = await this.prisma.customQuote.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Quote not found');

    if (existing.status !== 'DRAFT' && existing.status !== 'REQUESTED') {
      throw new BadRequestException(
        'Quote has already been sent or finalized — header is immutable. Cancel and create a new one.',
      );
    }

    const data: Record<string, unknown> = {};
    if (dto.customerName !== undefined)
      data.customerName = dto.customerName.trim();
    if (dto.customerPhone !== undefined)
      data.customerPhone = dto.customerPhone?.trim() || null;
    if (dto.adminNotes !== undefined)
      data.adminNotes = dto.adminNotes?.trim() || null;
    if (dto.externalLinks !== undefined)
      data.externalLinks = this.sanitizeUrls(dto.externalLinks);
    if (dto.validityDays !== undefined) {
      const days = await this.getValidityDays(dto.validityDays);
      data.expiresAt = this.expiresAtFromNow(days);
    }

    return this.prisma.customQuote.update({ where: { id }, data });
  }

  async addItem(quoteId: string, dto: CreateQuoteItemDto) {
    const quote = await this.prisma.customQuote.findUnique({
      where: { id: quoteId },
      select: { id: true, status: true, items: { select: { id: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');

    if (quote.status !== 'DRAFT' && quote.status !== 'REQUESTED') {
      throw new BadRequestException(
        'Quote has already been sent or finalized — items are immutable',
      );
    }
    return this.prisma.customQuoteItem.create({
      data: {
        quoteId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        unitPrice: this.assertFiniteNumber(dto.unitPrice, 'unitPrice'),
        maxQuantity: dto.maxQuantity ?? 1,
        weight: this.assertFiniteNumber(dto.weight, 'weight'),
        width: this.assertFiniteNumber(dto.width, 'width'),
        height: this.assertFiniteNumber(dto.height, 'height'),
        length: this.assertFiniteNumber(dto.lengthCm, 'lengthCm'),
        sortOrder: dto.sortOrder ?? quote.items.length,
      },
    });
  }

  async updateItem(itemId: string, dto: UpdateQuoteItemDto) {
    const item = await this.prisma.customQuoteItem.findUnique({
      where: { id: itemId },
      include: { quote: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.status === 'ACCEPTED') {
      throw new BadRequestException(
        'Item already purchased — cannot be edited',
      );
    }

    if (item.quote.status !== 'DRAFT' && item.quote.status !== 'REQUESTED') {
      throw new BadRequestException(
        'Quote has already been sent — items are immutable. Cancel and create a new one to change.',
      );
    }
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined)
      data.description = dto.description?.trim() || null;
    if (dto.unitPrice !== undefined)
      data.unitPrice = this.assertFiniteNumber(dto.unitPrice, 'unitPrice');
    if (dto.maxQuantity !== undefined) data.maxQuantity = dto.maxQuantity;
    if (dto.weight !== undefined)
      data.weight = this.assertFiniteNumber(dto.weight, 'weight');
    if (dto.width !== undefined)
      data.width = this.assertFiniteNumber(dto.width, 'width');
    if (dto.height !== undefined)
      data.height = this.assertFiniteNumber(dto.height, 'height');

    if (dto.lengthCm !== undefined)
      data.length = this.assertFiniteNumber(dto.lengthCm, 'lengthCm');
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.customQuoteItem.update({ where: { id: itemId }, data });
  }

  async deleteItem(itemId: string) {
    const item = await this.prisma.customQuoteItem.findUnique({
      where: { id: itemId },
      include: { quote: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.status === 'ACCEPTED') {
      throw new BadRequestException(
        'Item already purchased — cannot be removed',
      );
    }
    if (item.quote.status !== 'DRAFT' && item.quote.status !== 'REQUESTED') {
      throw new BadRequestException(
        'Quote has already been sent — items are immutable',
      );
    }
    return this.prisma.customQuoteItem.delete({ where: { id: itemId } });
  }

  async send(id: string) {
    const quote = await this.prisma.customQuote.findUnique({
      where: { id },
      include: { items: { select: { id: true, name: true, unitPrice: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');

    if (quote.status !== 'DRAFT' && quote.status !== 'REQUESTED') {
      throw new BadRequestException(
        `Only drafts can be sent. Current status: ${quote.status}. Use resendEmail if already sent.`,
      );
    }
    if (!quote.items.length) {
      throw new BadRequestException(
        'Add at least one item before sending the quote',
      );
    }

    const validityDays = await this.getValidityDays();
    const now = new Date();

    const updated = await this.prisma.customQuote.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: now,
        expiresAt: this.expiresAtFromNow(validityDays),
      },
    });

    await this.emailQueue
      .enqueueCustomQuoteSentCustomer({
        to: quote.customerEmail as unknown as string,
        customerName: quote.customerName,
        quoteNumber: quote.number,
        token: quote.token,
        items: quote.items.map((i) => ({
          name: i.name,
          unitPrice: i.unitPrice,
        })),
        expiresAt: updated.expiresAt.toISOString(),
      })
      .catch((err) => {
        this.logger.error(`Failed to enqueue customer email: ${err.message}`);
        captureFailOpen(err, 'custom_quote_email_customer_enqueue', {
          quoteNumber: quote.number,
        });
      });

    return updated;
  }

  async resendEmail(id: string) {
    const quote = await this.prisma.customQuote.findUnique({
      where: { id },
      include: { items: { select: { name: true, unitPrice: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (!PENDING_STATUSES_FOR_ACCEPT.has(quote.status)) {
      throw new BadRequestException(
        'Quote not in a state that allows resending',
      );
    }

    await this.emailQueue.enqueueCustomQuoteSentCustomer({
      to: quote.customerEmail,
      customerName: quote.customerName,
      quoteNumber: quote.number,
      token: quote.token,
      items: quote.items,
      expiresAt: quote.expiresAt.toISOString(),
    });
    return { ok: true };
  }

  async cancel(id: string) {
    const quote = await this.prisma.customQuote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status === 'FULLY_ACCEPTED') {
      throw new BadRequestException('Quote already fully accepted');
    }
    return this.prisma.customQuote.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async findAllAdmin(params: {
    status?: string;
    page: number;
    perPage: number;
  }) {
    const { status, page, perPage } = params;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.customQuote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          items: { select: { id: true, unitPrice: true, status: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.customQuote.count({ where }),
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

  async findByIdAdmin(id: string) {
    const quote = await this.prisma.customQuote.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        images: {
          include: { mediaFile: true },

          orderBy: { order: 'asc' },
        },
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async countPendingRequested() {
    return this.prisma.customQuote.count({ where: { status: 'REQUESTED' } });
  }

  async attachImages(
    quoteId: string,
    mediaFileIds: string[],
    uploadedBy: 'ADMIN' | 'CUSTOMER',
  ) {
    const quote = await this.prisma.customQuote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        status: true,
        images: { select: { order: true } },
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');

    if (quote.status !== 'DRAFT' && quote.status !== 'REQUESTED') {
      throw new BadRequestException(
        'Quote has already been sent — images are immutable',
      );
    }

    const baseOrder = quote.images.length;
    await this.prisma.customQuoteImage.createMany({
      data: mediaFileIds.map((mediaFileId, i) => ({
        quoteId,
        mediaFileId,
        uploadedBy,
        order: baseOrder + i,
      })),
    });
    return { ok: true, count: mediaFileIds.length };
  }

  async assertQuoteItemPurchasable(quoteItemId: string, userEmail: string) {
    const item = await this.prisma.customQuoteItem.findUnique({
      where: { id: quoteItemId },
      include: {
        quote: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
            userId: true,
            customerEmail: true,
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Quote item not found');

    if (!PENDING_STATUSES_FOR_ACCEPT.has(item.quote.status)) {
      throw new BadRequestException(
        'Quote not in a state that allows purchase',
      );
    }
    if (item.quote.expiresAt < new Date()) {
      throw new BadRequestException('Quote expired');
    }
    if (item.status !== 'QUOTED') {
      throw new BadRequestException('Item already purchased or canceled');
    }

    const normalizedOwner = item.quote.customerEmail.toLowerCase();
    const normalizedUser = userEmail.toLowerCase();
    if (normalizedOwner !== normalizedUser) {
      throw new ForbiddenException('This quote belongs to another customer');
    }

    return item;
  }

  async expireOutdated() {
    return this.prisma.customQuote.updateMany({
      where: {
        status: { in: ['SENT', 'PARTIALLY_ACCEPTED'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
  }

  private sanitizeLog(value: string): string {

    return value.replace(/[\r\n]/g, ' ').slice(0, 255);
  }
}
