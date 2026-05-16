import {
  Injectable,
  Logger,
  OnModuleDestroy,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CouponsService } from '../coupons/coupons.service';
import { EmailQueueService } from '../email/email-queue.service';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';
import { captureFailOpen } from '../observability/fail-open-capture';

const QUEUE_NAME = 'review-invites';

@Injectable()
export class ReviewInvitesService implements OnModuleDestroy {
  private readonly logger = new Logger(ReviewInvitesService.name);
  private readonly queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly coupons: CouponsService,
    private readonly emailQueue: EmailQueueService,
  ) {
    this.queue = new Queue(
      QUEUE_NAME,
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 500 },
        },
      }),
    );
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async createForOrder(orderId: string) {
    const cfg = await this.settings.getReviewSettings();
    if (!cfg.enabled) return null;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { reviewInvite: true },
    } as any);

    if (!order) throw new NotFoundException('Order not found');
    if ((order as any).reviewInvite) return (order as any).reviewInvite;

    const token = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(
      Date.now() + cfg.inviteValidityDays * 86400000,
    );

    const invite = await this.prisma.reviewInvite.create({
      data: {
        orderId,
        userId: (order as any).userId,
        token,
        tokenExpiresAt,
      },
    });

    const firstDelayMs = cfg.firstEmailDays * 86400000;
    const reminderDelayMs = (cfg.firstEmailDays + cfg.reminderDays) * 86400000;

    await this.queue.add(
      'review-request',
      { inviteId: invite.id },
      { delay: firstDelayMs, jobId: `review-request-${orderId}` },
    );
    await this.queue.add(
      'review-reminder',
      { inviteId: invite.id },
      { delay: reminderDelayMs, jobId: `review-reminder-${orderId}` },
    );

    this.logger.log(
      `Created review invite for order ${orderId} (token expires in ${cfg.inviteValidityDays}d)`,
    );

    return invite;
  }

  async findByToken(token: string) {
    const invite = await this.prisma.reviewInvite.findUnique({
      where: { token },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: {
                      where: { isMain: true },
                      include: { mediaFile: true },
                      take: 1,
                    },
                  },
                },
                variation: true,
              },
            },
          },
        },
        user: true,
      },
    } as any);

    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.submittedAt) {
      throw new BadRequestException('This review was already submitted');
    }
    if (invite.tokenExpiresAt < new Date()) {
      throw new BadRequestException('The review link has expired');
    }

    return {
      invite,
      order: (invite as any).order,
      user: (invite as any).user,
    };
  }

  async submit(token: string, dto: SubmitReviewDto) {
    const invite = await this.prisma.reviewInvite.findUnique({
      where: { token },
      include: {
        order: { include: { items: true } },
        user: true,
      },
    } as any);

    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.submittedAt) {
      throw new BadRequestException('This review was already submitted');
    }
    if (invite.tokenExpiresAt < new Date()) {
      throw new BadRequestException('The review link has expired');
    }

    const order = (invite as any).order;
    const user = (invite as any).user;
    const allowedProductIds = new Set(order.items.map((i: any) => i.productId));
    for (const p of dto.products) {
      if (!allowedProductIds.has(p.productId)) {
        throw new BadRequestException(
          `Product ${p.productId} does not belong to this order`,
        );
      }
    }

    const coupon = await this.prisma.$transaction(async (tx: any) => {

      const fresh = await tx.reviewInvite.findUnique({
        where: { id: invite.id },
        select: { submittedAt: true },
      });
      if (fresh?.submittedAt) {
        throw new BadRequestException('This review was already submitted');
      }

      const newCoupon = await this.coupons.createReviewReward(
        invite.userId,
        tx,
      );

      await tx.siteReview.create({
        data: {
          orderId: order.id,
          userId: invite.userId,
          rating: dto.site.rating,
          comment: dto.site.comment,
          displayName: dto.displayName,
        },
      });

      for (const p of dto.products) {
        await tx.review.create({
          data: {
            orderId: order.id,
            userId: invite.userId,
            productId: p.productId,
            rating: p.rating,
            comment: p.comment,
            images: p.mediaFileIds ? JSON.stringify(p.mediaFileIds) : null,
            displayName: dto.displayName,
            inviteId: invite.id,
            isApproved: true,
          },
        });
      }

      const updateResult = await tx.reviewInvite.updateMany({
        where: { id: invite.id, submittedAt: null },
        data: { submittedAt: new Date(), couponId: newCoupon.id },
      });
      if (updateResult.count === 0) {
        throw new BadRequestException('This review was already submitted');
      }

      return newCoupon;
    });

    await this.cancelJob(`review-reminder-${order.id}`);

    const cfg = await this.settings.getReviewSettings();
    const discountPercent =
      cfg.couponType === 'PERCENTAGE' ? cfg.couponValue : 0;

    try {
      await this.emailQueue.enqueueReviewReward({
        to: user.email ?? order.customerEmail,
        customerName: user.name ?? order.customerName ?? 'Client',
        productName: order.items[0]?.product?.name ?? 'your last order',
        couponCode: coupon.code,
        discountPercent,
      });
    } catch (err) {
      this.logger.error(
        `Failed to enqueue review-reward email for invite ${invite.id}: ${err}`,
      );
      captureFailOpen(err, 'review_reward_email_enqueue', {
        inviteId: invite.id,
      });
    }

    return { invite, coupon };
  }

  private async cancelJob(jobId: string) {
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled review job ${jobId}`);
      }
    } catch (err) {
      this.logger.warn(`Could not cancel ${jobId}: ${err}`);
    }
  }
}
