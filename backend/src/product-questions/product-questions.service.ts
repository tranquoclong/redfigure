import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductQuestionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TurnstileService } from '../turnstile/turnstile.service';
import { EmailQueueService } from '../email/email-queue.service';
import { SettingsService } from '../settings/settings.service';
import { sanitizeText } from '../common/utils/text-sanitizer';
import { parseEmailRecipients } from '../common/utils/email-recipients';
import { captureFailOpen } from '../observability/fail-open-capture';

export interface AskAuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface AskRequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface AskDtoInput {
  productId: string;
  question: string;
  acceptLgpd: boolean;
  askerName?: string;
  askerEmail?: string;
  turnstileToken?: string;
  website?: string;
}

function sanitizeLogValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/[\r\n]+/g, ' ').slice(0, 255);
}

export function formatPublicAuthorName(
  fullName: string | null | undefined,
): string {
  if (!fullName) return 'Ẩn danh';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Ẩn danh';
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

@Injectable()
export class ProductQuestionsService {
  private readonly logger = new Logger(ProductQuestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    private readonly emailQueue: EmailQueueService,
    private readonly settings: SettingsService,
    private readonly configService: ConfigService,
  ) { }

  private async resolveAdminRecipients(): Promise<string[]> {
    const csv = await this.settings.get('low_stock_email_recipients');
    const fromDb = parseEmailRecipients(csv);
    if (fromDb.length > 0) return fromDb;
    return parseEmailRecipients(this.configService.get<string>('ADMIN_EMAIL'));
  }

  async ask(
    dto: AskDtoInput,
    user: AskAuthUser | null,
    meta: AskRequestMeta,
  ): Promise<{ ok: true; id?: string }> {
    const safeIp = sanitizeLogValue(meta.ipAddress);
    const safeUa = sanitizeLogValue(meta.userAgent);

    if (typeof dto.website === 'string' && dto.website.length > 0) {
      this.logger.warn(
        `Honeypot triggered from ${safeIp ?? 'unknown-ip'} (UA="${safeUa ?? '-'}")`,
      );
      return { ok: true };
    }

    if (dto.acceptLgpd !== true) {
      throw new BadRequestException(
        'It is necessary to accept the Privacy Policy to send the question.',
      );
    }

    let askerName: string;
    let askerEmail: string;
    let userId: string | undefined;

    if (user) {

      askerName = (user.name ?? user.email).trim();
      askerEmail = user.email.trim().toLowerCase();
      userId = user.id;

    } else {

      if (!dto.askerName?.trim() || !dto.askerEmail?.trim()) {
        throw new BadRequestException(
          'Please provide your name and email to ask a question.',
        );
      }
      if (!dto.turnstileToken?.trim()) {
        throw new BadRequestException(
          'Security verification failed. Reload the page and try again.',
        );
      }
      const ok = await this.turnstile.verify(dto.turnstileToken, safeIp);
      if (!ok) {
        throw new BadRequestException(
          'Security verification failed. Reload the page and try again.',
        );
      }
      askerName = dto.askerName.trim();
      askerEmail = dto.askerEmail.trim().toLowerCase();
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        isDraft: true,
      },
    });
    if (!product || !product.isActive || product.isDraft) {
      throw new NotFoundException('Product not found.');
    }

    const cleanQuestion = sanitizeText(dto.question);
    if (cleanQuestion.length < 5) {
      throw new BadRequestException(
        'Question too short. Please write with more details.',
      );
    }

    const created = await this.prisma.productQuestion.create({
      data: {
        productId: product.id,
        userId,
        askerName,
        askerEmail,
        question: cleanQuestion,
        status: ProductQuestionStatus.PENDING,
        ipAddress: safeIp,
        userAgent: safeUa,
      },
      select: { id: true },
    });

    try {
      const recipients = await this.resolveAdminRecipients();
      if (recipients.length > 0) {
        await this.emailQueue.enqueueProductQuestionReceived({
          to: recipients.join(', '),
          productName: product.name,
          productSlug: product.slug,
          questionId: created.id,
          askerName,
          askerEmail,
          question: cleanQuestion,
          ipAddress: safeIp,
        });
      } else {
        this.logger.warn(
          'No admin recipient configured for question alerts',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to enqueue admin email: ${msg}`);
      captureFailOpen(err, 'product_question_email_admin_enqueue', {
        questionId: created.id,
      });
    }

    return { ok: true, id: created.id };
  }

  async findPublicByProduct(
    productId: string,
    page = 1,
    perPage = 10,
    currentUserId?: string,
  ) {
    const where = {
      productId,
      status: ProductQuestionStatus.ANSWERED,
    };
    const [rows, total] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where,
        orderBy: { answeredAt: 'desc' as const },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          askerName: true,
          question: true,
          answer: true,
          answeredAt: true,
          createdAt: true,

          userId: true,
        },
      }),
      this.prisma.productQuestion.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        askerName: formatPublicAuthorName(r.askerName),
        question: r.question,
        answer: r.answer,
        answeredAt: r.answeredAt,
        createdAt: r.createdAt,

        isOwn: !!(currentUserId && r.userId && r.userId === currentUserId),
      })),
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async findAllAdmin(params: {
    status?: ProductQuestionStatus;
    productId?: string;
    page?: number;
    perPage?: number;
  }) {
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    const where: {
      status?: ProductQuestionStatus;
      productId?: string;
    } = {};
    if (params.status) where.status = params.status;
    if (params.productId) where.productId = params.productId;

    const [rows, total] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where,
        orderBy: { createdAt: 'desc' as const },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          product: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.productQuestion.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async answer(questionId: string, rawAnswer: string, adminUserId: string) {
    const question = await this.prisma.productQuestion.findUnique({
      where: { id: questionId },
      include: {
        product: { select: { name: true, slug: true } },
      },
    });
    if (!question) throw new NotFoundException('Question not found.');

    const cleanAnswer = sanitizeText(rawAnswer);
    if (cleanAnswer.length < 5) {
      throw new BadRequestException(
        'Answer too short. Please write with more details.',
      );
    }

    const updated = await this.prisma.productQuestion.update({
      where: { id: questionId },
      data: {
        answer: cleanAnswer,
        answeredAt: new Date(),
        answeredById: adminUserId,
        status: ProductQuestionStatus.ANSWERED,
      },
    });

    try {
      await this.emailQueue.enqueueProductQuestionAnswered({
        to: question.askerEmail,
        askerName: question.askerName,
        productName: question.product.name,
        productSlug: question.product.slug,
        question: question.question,
        answer: cleanAnswer,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to enqueue email to author: ${msg}`);
      captureFailOpen(err, 'product_question_email_author_enqueue', {
        questionId: question.id,
      });
    }

    return updated;
  }

  async reject(questionId: string) {
    const question = await this.prisma.productQuestion.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!question) throw new NotFoundException('Question not found.');

    return this.prisma.productQuestion.update({
      where: { id: questionId },
      data: { status: ProductQuestionStatus.REJECTED },
    });
  }

  async delete(
    questionId: string,
    requester: { id: string; role: 'ADMIN' | 'CUSTOMER' },
  ) {
    const question = await this.prisma.productQuestion.findUnique({
      where: { id: questionId },
      select: { id: true, userId: true },
    });
    if (!question) throw new NotFoundException('Question not found.');

    if (requester.role !== 'ADMIN') {

      if (!question.userId || question.userId !== requester.id) {
        throw new ForbiddenException(
          'You do not have permission to delete this question.',
        );
      }
    }

    return this.prisma.productQuestion.delete({
      where: { id: questionId },
    });
  }

  async countPending(): Promise<{ count: number }> {
    const count = await this.prisma.productQuestion.count({
      where: { status: ProductQuestionStatus.PENDING },
    });
    return { count };
  }
}
