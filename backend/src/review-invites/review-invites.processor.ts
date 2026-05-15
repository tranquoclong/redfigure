import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EmailQueueService } from '../email/email-queue.service';
import { UnsubscribeService } from '../users/unsubscribe.service';

@Injectable()
export class ReviewInvitesProcessor {
  private readonly logger = new Logger(ReviewInvitesProcessor.name);
  private readonly storeUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly emailQueue: EmailQueueService,
    private readonly unsubscribe: UnsubscribeService,
    private readonly config: ConfigService,
  ) {
    this.storeUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'https://redfigure.com';
  }

  async handle(jobName: string, data: { inviteId: string }) {
    const invite = await this.prisma.reviewInvite.findUnique({
      where: { id: data.inviteId },
      include: {
        order: { include: { items: { include: { product: true } } } },
        user: true,
      },
    } as any);

    if (!invite) {
      this.logger.warn(`Invite ${data.inviteId} not found — skipping`);
      return;
    }
    if ((invite as any).submittedAt) {
      this.logger.log(
        `Invite ${data.inviteId} already submitted — skipping ${jobName}`,
      );
      return;
    }
    if ((invite as any).tokenExpiresAt < new Date()) {
      this.logger.log(`Invite ${data.inviteId} expired — skipping ${jobName}`);
      return;
    }

    const cfg = await this.settings.getReviewSettings();
    const order = (invite as any).order;
    const user = (invite as any).user;

    if (user?.emailMarketingOptOut) {
      this.logger.log(
        `User ${user.id} opted out of marketing — skipping ${jobName}`,
      );
      return;
    }

    const reviewUrl = `${this.storeUrl}/review/${invite.token}`;
    const discountPercent =
      cfg.couponType === 'PERCENTAGE' ? cfg.couponValue : 0;
    const discountLabel =
      cfg.couponType === 'FIXED'
        ? `${cfg.couponValue.toFixed(2).replace('.', ',')}VND`
        : `${cfg.couponValue}%`;

    const unsubscribeUrl = user?.id
      ? await this.unsubscribe.buildUrl(user.id)
      : '';
    const unsubscribeOneClickUrl = user?.id
      ? await this.unsubscribe.buildOneClickUrl(user.id)
      : '';

    const payload = {
      to: user?.email ?? order.customerEmail,
      customerName: user?.name ?? order.customerName ?? 'Client',
      reviewUrl,
      discountPercent,
      discountLabel,
      couponValidityDays: cfg.couponValidityDays,
      unsubscribeUrl,
      unsubscribeOneClickUrl,
    };

    if (jobName === 'review-request') {
      await this.emailQueue.enqueueReviewRequest(payload);
      await this.prisma.reviewInvite.update({
        where: { id: invite.id },
        data: { sentAt: new Date() },
      });
    } else if (jobName === 'review-reminder') {
      await this.emailQueue.enqueueReviewReminder(payload);
      await this.prisma.reviewInvite.update({
        where: { id: invite.id },
        data: { reminderSentAt: new Date() },
      });
    }
  }
}
