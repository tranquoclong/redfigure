import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import { EmailService } from './email.service';
import { getSharedBullMqConnection, withBullMqPrefix } from '../common/bullmq';

type EmailType =
  | 'welcome'
  | 'payment-approved'
  | 'order-in-production'
  | 'order-shipped'
  | 'order-delivered'
  | 'order-cancelled'
  | 'order-refunded'
  | 'password-reset'
  | 'login-code'
  | 'review-reward'
  | 'review-request'
  | 'review-reminder'
  | 'low-stock-alert'
  | 'product-question-received'
  | 'product-question-answered'
  | 'custom-quote-request-admin'
  | 'custom-quote-sent-customer'
  | 'affiliate-welcome'
  | 'affiliate-payment-request-admin'
  | 'affiliate-payment-received'
  | 'cart-abandonment-first'
  | 'cart-abandonment-second';

export interface EmailOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface EmailJob {
  type: EmailType;
  payload: any;
}

@Injectable()
export class EmailQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueService.name);
  private queue: Queue;

  constructor(private readonly emailService: EmailService) {
    this.queue = new Queue(
      'email',
      withBullMqPrefix({
        connection: getSharedBullMqConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },

          removeOnComplete: { count: 100, age: 3600 },

          removeOnFail: { count: 500, age: 86400 },
        },
      }),
    );
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async enqueueWelcome(payload: { to: string; name: string }) {
    return this.queue.add('welcome', { type: 'welcome', payload });
  }

  async enqueueAffiliateWelcome(payload: {
    to: string;
    name: string;
    publicId: number;
  }) {
    return this.queue.add('affiliate-welcome', {
      type: 'affiliate-welcome',
      payload,
    });
  }

  async enqueueAffiliatePaymentRequestAdmin(payload: {
    to: string;
    affiliatePublicId: number;
    affiliateName: string;
    amount: number;
    requestId: string;
  }) {
    return this.queue.add('affiliate-payment-request-admin', {
      type: 'affiliate-payment-request-admin',
      payload,
    });
  }

  async enqueueAffiliatePaymentReceived(payload: {
    to: string;
    name: string;
    amount: number;
    note?: string;
  }) {
    return this.queue.add('affiliate-payment-received', {
      type: 'affiliate-payment-received',
      payload,
    });
  }

  async enqueuePaymentApproved(payload: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
    items: EmailOrderItem[];
    total: number;
    paymentMethod: string;
  }) {
    return this.queue.add('payment-approved', {
      type: 'payment-approved',
      payload,
    });
  }

  async enqueueOrderInProduction(payload: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
  }) {
    return this.queue.add('order-in-production', {
      type: 'order-in-production',
      payload,
    });
  }

  async enqueueOrderShipped(payload: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
    trackingCode?: string;
    trackingUrl?: string;
    carrier?: string;
    deliveryDays?: number;
  }) {
    return this.queue.add('order-shipped', {
      type: 'order-shipped',
      payload,
    });
  }

  async enqueueOrderDelivered(payload: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
  }) {
    return this.queue.add('order-delivered', {
      type: 'order-delivered',
      payload,
    });
  }

  async enqueueOrderCancelled(payload: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
    reason?: string;
  }) {
    return this.queue.add('order-cancelled', {
      type: 'order-cancelled',
      payload,
    });
  }

  async enqueueOrderRefunded(payload: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
    reason?: string;
  }) {
    return this.queue.add('order-refunded', {
      type: 'order-refunded',
      payload,
    });
  }

  async enqueuePasswordReset(payload: {
    to: string;
    name: string;
    resetUrl: string;
  }) {

    return this.queue.add(
      'password-reset',
      { type: 'password-reset', payload },
      {
        removeOnComplete: true,
        removeOnFail: { count: 10, age: 3600 },
      },
    );
  }

  async enqueueLoginCode(payload: {
    to: string;
    name: string;
    code: string;
    purpose: 'LOGIN' | 'CLAIM';
  }) {

    return this.queue.add(
      'login-code',
      { type: 'login-code', payload },
      {
        removeOnComplete: true,
        removeOnFail: { count: 10, age: 3600 },
      },
    );
  }

  async enqueueReviewReward(payload: {
    to: string;
    customerName: string;
    productName: string;
    couponCode: string;
    discountPercent: number;
  }) {
    return this.queue.add('review-reward', {
      type: 'review-reward',
      payload,
    });
  }

  async enqueueReviewRequest(payload: {
    to: string;
    customerName: string;
    reviewUrl: string;
    discountPercent: number;
    discountLabel?: string;
    couponValidityDays: number;
    unsubscribeUrl?: string;
    unsubscribeOneClickUrl?: string;
  }) {

    return this.queue.add(
      'review-request',
      { type: 'review-request', payload },
      { removeOnComplete: true, removeOnFail: { count: 10, age: 3600 } },
    );
  }

  async enqueueReviewReminder(payload: {
    to: string;
    customerName: string;
    reviewUrl: string;
    discountPercent: number;
    discountLabel?: string;
    couponValidityDays: number;
    unsubscribeUrl?: string;
    unsubscribeOneClickUrl?: string;
  }) {
    return this.queue.add(
      'review-reminder',
      { type: 'review-reminder', payload },
      { removeOnComplete: true, removeOnFail: { count: 10, age: 3600 } },
    );
  }

  async enqueueLowStockAlert(payload: {
    to: string;
    productName: string;
    currentStock: number;
    threshold: number;
    variationName?: string;
  }) {
    return this.queue.add('low-stock-alert', {
      type: 'low-stock-alert',
      payload,
    });
  }

  async enqueueProductQuestionReceived(payload: {
    to: string;
    productName: string;
    productSlug: string;
    questionId: string;
    askerName: string;
    askerEmail: string;
    question: string;
    ipAddress?: string;
  }) {
    return this.queue.add('product-question-received', {
      type: 'product-question-received',
      payload,
    });
  }

  async enqueueProductQuestionAnswered(payload: {
    to: string;
    askerName: string;
    productName: string;
    productSlug: string;
    question: string;
    answer: string;
  }) {

    return this.queue.add('product-question-answered', {
      type: 'product-question-answered',
      payload,
    });
  }

  async enqueueCustomQuoteRequestAdmin(payload: {
    to: string | string[];
    quoteNumber: string;
    quoteId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    description: string;
    externalLinks: string[];
  }) {
    return this.queue.add('custom-quote-request-admin', {
      type: 'custom-quote-request-admin',
      payload,
    });
  }

  async enqueueCustomQuoteSentCustomer(payload: {
    to: string;
    customerName: string;
    quoteNumber: string;
    token: string;
    items: Array<{ name: string; unitPrice: number }>;
    expiresAt: string;
  }) {

    return this.queue.add(
      'custom-quote-sent-customer',
      { type: 'custom-quote-sent-customer', payload },
      { removeOnComplete: true, removeOnFail: { count: 10, age: 3600 } },
    );
  }

  async enqueueCartAbandonmentFirst(
    payload: {
      to: string;
      customerName: string;
      items: EmailOrderItem[];
      total: number;
      cartUrl: string;
      unsubscribeUrl: string;

      unsubscribeOneClickUrl: string;
      cartId: string;

      cycleKey: number;
    },
    opts?: JobsOptions,
  ) {
    return this.queue.add(
      'cart-abandonment-first',
      { type: 'cart-abandonment-first', payload },
      opts,
    );
  }

  async enqueueCartAbandonmentSecond(
    payload: {
      to: string;
      customerName: string;
      items: EmailOrderItem[];
      total: number;
      cartUrl: string;
      unsubscribeUrl: string;
      unsubscribeOneClickUrl: string;
      couponCode: string;
      couponLabel: string;
      couponValidUntil: Date;
      cartId: string;
      cycleKey: number;
    },
    opts?: JobsOptions,
  ) {
    return this.queue.add(
      'cart-abandonment-second',
      { type: 'cart-abandonment-second', payload },
      opts,
    );
  }

  async processJob(job: EmailJob): Promise<void> {
    const { type, payload } = job;

    switch (type) {
      case 'welcome':
        await this.emailService.sendWelcome(payload);
        break;
      case 'affiliate-welcome':
        await this.emailService.sendAffiliateWelcome(payload);
        break;
      case 'payment-approved':
        await this.emailService.sendPaymentApproved(payload);
        break;
      case 'order-in-production':
        await this.emailService.sendOrderInProduction(payload);
        break;
      case 'order-shipped':
        await this.emailService.sendOrderShipped(payload);
        break;
      case 'order-delivered':
        await this.emailService.sendOrderDelivered(payload);
        break;
      case 'order-cancelled':
        await this.emailService.sendOrderCancelled(payload);
        break;
      case 'order-refunded':
        await this.emailService.sendOrderRefunded(payload);
        break;
      case 'password-reset':
        await this.emailService.sendPasswordReset(payload);
        break;
      case 'login-code':
        await this.emailService.sendLoginCode(payload);
        break;
      case 'review-reward':
        await this.emailService.sendReviewReward(payload);
        break;
      case 'review-request':
        await this.emailService.sendReviewRequest(payload);
        break;
      case 'review-reminder':
        await this.emailService.sendReviewReminder(payload);
        break;
      case 'low-stock-alert':
        await this.emailService.sendLowStockAlert(payload);
        break;
      case 'product-question-received':
        await this.emailService.sendProductQuestionReceived(payload);
        break;
      case 'product-question-answered':
        await this.emailService.sendProductQuestionAnswered(payload);
        break;
      case 'custom-quote-request-admin':
        await this.emailService.sendCustomQuoteRequestAdmin(payload);
        break;
      case 'custom-quote-sent-customer':
        await this.emailService.sendCustomQuoteSentCustomer(payload);
        break;
      case 'affiliate-payment-request-admin':
        await this.emailService.sendAffiliatePaymentRequestAdmin(payload);
        break;
      case 'affiliate-payment-received':
        await this.emailService.sendAffiliatePaymentReceived(payload);
        break;
      case 'cart-abandonment-first':
        await this.emailService.sendCartAbandonmentFirst(payload);
        break;
      case 'cart-abandonment-second':
        await this.emailService.sendCartAbandonmentSecond(payload);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    this.logger.log(`Email sent: ${type} to ${payload.to}`);
  }
}
