import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import sanitizeHtml from 'sanitize-html';
import { render } from '@react-email/render';
import { EmailTemplateService } from './email-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { escapeHtml } from './escape-html';
import { WelcomeEmail } from './templates/welcome';
import { PasswordResetEmail } from './templates/password-reset';
import { LoginCodeEmail } from './templates/login-code';
import { ReviewRewardEmail } from './templates/review-reward';
import { ReviewRequestEmail } from './templates/review-request';
import { ReviewReminderEmail } from './templates/review-reminder';
import { ContactEmail } from './templates/contact';
import { ProductQuestionReceivedEmail } from './templates/product-question-received';
import { ProductQuestionAnsweredEmail } from './templates/product-question-answered';
import { CustomQuoteRequestAdminEmail } from './templates/custom-quote-request-admin';
import { CustomQuoteSentCustomerEmail } from './templates/custom-quote-sent-customer';
import { AffiliateWelcomeEmail } from './templates/affiliate-welcome';
import { AffiliatePaymentRequestAdminEmail } from './templates/affiliate-payment-request-admin';
import { AffiliatePaymentReceivedEmail } from './templates/affiliate-payment-received';
import { NewsletterConfirmEmail } from './templates/newsletter-confirm';


function formatCurrency(value: number): string {
  return value.toLocaleString('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private from: string;
  private storeUrl: string;

  private readonly stagingAllowlist: Set<string> | null;

  constructor(
    private configService: ConfigService,
    private emailTemplateService: EmailTemplateService,
    private prisma: PrismaService,
  ) {
    this.from =
      this.configService.get<string>('SMTP_FROM') ?? 'noreply@redfigure.com';
    this.storeUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      'https://redfigure.com';

    const rawPort = this.configService.get<string>('SMTP_PORT');
    const parsed = rawPort ? parseInt(rawPort, 10) : NaN;
    const port =
      Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 587;

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });

    this.stagingAllowlist = this.buildStagingAllowlist();
    if (this.stagingAllowlist) {
      this.logger.warn(
        `Staging email allowlist ON with ${this.stagingAllowlist.size} entries. ` +
        `Emails outside the list will be logged and discarded.`,
      );
    }
  }

  private buildStagingAllowlist(): Set<string> | null {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const raw = this.configService.get<string>('STAGING_EMAIL_ALLOWLIST');

    if (nodeEnv === 'production') return null;
    if (!raw || !raw.trim()) return null;
    const entries = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    return entries.length > 0 ? new Set(entries) : null;
  }

  async sendMail(params: {
    to: string;
    subject: string;
    html: string;

    unsubscribeOneClickUrl?: string;
  }) {
    if (this.stagingAllowlist) {

      const recipients = params.to
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);
      const blocked = recipients.filter((r) => !this.stagingAllowlist!.has(r));
      if (blocked.length > 0) {
        this.logger.warn(
          `[staging-allowlist] SKIP send: ${blocked.length} of ${recipients.length} ` +
          `recipient(s) outside allowlist. subject="${params.subject}"`,
        );
        return { skipped: true, reason: 'staging_allowlist' as const };
      }
    }
    const headers: Record<string, string> = {};
    if (params.unsubscribeOneClickUrl) {
      headers['List-Unsubscribe'] = `<${params.unsubscribeOneClickUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    return this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });
  }

  private async renderFromDb(
    type: string,
    variables: Record<string, string>,
    fallbackFn: () => Promise<string>,
    fallbackSubject: string,
  ): Promise<{ subject: string; html: string }> {
    try {
      const template = await this.emailTemplateService.findByType(type);
      if (template.isActive) {
        return this.emailTemplateService.renderTemplate(template, {
          ...variables,
          url_store: this.storeUrl,
        });
      }
    } catch (err) {

      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Template '${type}' lookup failed (${msg}), using React Email fallback`,
      );
    }

    const html = await fallbackFn();
    return { subject: fallbackSubject, html };
  }

  async sendWelcome(params: { to: string; name: string }) {
    const { subject, html } = await this.renderFromDb(
      'welcome',
      {
        name_client: params.name,
        email_client: params.to,
      },
      () => render(WelcomeEmail({ name: params.name })),
      `Welcome to RedFigure, ${params.name}!`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendAffiliateWelcome(params: {
    to: string;
    name: string;
    publicId: number;
  }) {
    const { subject, html } = await this.renderFromDb(
      'affiliate-welcome',
      {
        name_client: params.name,
        email_client: params.to,
        affiliate_public_id: String(params.publicId),
      },
      () =>
        render(
          AffiliateWelcomeEmail({
            name: params.name,
            publicId: params.publicId,
          }),
        ),
      `Welcome to RedFigure affiliate program, ${params.name}!`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendAffiliatePaymentRequestAdmin(params: {
    to: string;
    affiliatePublicId: number;
    affiliateName: string;
    amount: number;
    requestId: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'affiliate-payment-request-admin',
      {
        name_affiliate: params.affiliateName,
        affiliate_public_id: String(params.affiliatePublicId),
        valor_solicitado: formatCurrency(params.amount),
        request_id: params.requestId,
      },
      () =>
        render(
          AffiliatePaymentRequestAdminEmail({
            affiliatePublicId: params.affiliatePublicId,
            affiliateName: params.affiliateName,
            amount: params.amount,
            requestId: params.requestId,
          }),
        ),
      `New payment request — affiliate #${params.affiliatePublicId}`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendAffiliatePaymentReceived(params: {
    to: string;
    name: string;
    amount: number;
    note?: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'affiliate-payment-received',
      {
        name_client: params.name,
        email_client: params.to,
        valor_pago: formatCurrency(params.amount),
        observacao: params.note ?? '—',
      },
      () =>
        render(
          AffiliatePaymentReceivedEmail({
            name: params.name,
            amount: params.amount,
            note: params.note,
          }),
        ),
      `Payment received: ${formatCurrency(params.amount)}VND`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  private buildItemsHtml(
    items: Array<{ name: string; quantity: number; price: number }>,
  ): string {

    return items
      .map(
        (item) =>
          `<div style="padding:8px 0;display:flex;justify-content:space-between"><span style="color:#1a1a2e;font-size:14px">${escapeHtml(item.name)} × ${escapeHtml(String(item.quantity))}</span><span style="color:#1a1a2e;font-size:14px">${escapeHtml(formatCurrency(item.price * item.quantity))}VND</span></div>`,
      )
      .join('');
  }

  private orderUrl(orderId: string): string {
    return `${this.storeUrl}/my-account/orders/${orderId}`;
  }

  private cartUrl(): string {
    return `${this.storeUrl}/cart`;
  }

  private async cartCycleChanged(
    cartId: string,
    cycleKey: number,
  ): Promise<boolean> {
    try {
      const fresh = await this.prisma.cart.findUnique({
        where: { id: cartId },
        select: { updatedAt: true },
      });
      if (!fresh) return true;
      return new Date(fresh.updatedAt).getTime() !== cycleKey;
    } catch (err) {
      this.logger.warn(
        `cartCycleChanged lookup failed (cart=${cartId}): ${err instanceof Error ? err.message : String(err)
        }`,
      );
      return true;
    }
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async sendPaymentApproved(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
  }) {
    const { subject, html } = await this.renderFromDb(
      'payment-approved',
      {
        name_client: params.customerName,
        numero_order: params.orderNumber,
        itens_order: this.buildItemsHtml(params.items),
        total: formatCurrency(params.total),
        url_order: this.orderUrl(params.orderId),
      },
      () =>
        Promise.resolve(
          `<h2>Payment confirmed — ${escapeHtml(params.orderNumber)}</h2>
          <p>Hello, ${escapeHtml(params.customerName)}! Your payment has been approved and we are already preparing your order.</p>
          <p>Total: ${formatCurrency(params.total)} VND</p>
          <p><a href="${escapeHtml(this.orderUrl(params.orderId))}">Track your order</a></p>`,
        ),
      `Payment confirmed — order ${params.orderNumber}`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendOrderInProduction(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'order-in-production',
      {
        name_client: params.customerName,
        numero_order: params.orderNumber,
        url_order: this.orderUrl(params.orderId),
      },
      () =>
        Promise.resolve(
          `<h2>Your order ${escapeHtml(params.orderNumber)} entered production</h2>
          <p>Hello, ${escapeHtml(params.customerName)}! Your miniatures are already on the printer.</p>
          <p><a href="${escapeHtml(this.orderUrl(params.orderId))}">Track your order</a></p>`,
        ),
      `Order ${params.orderNumber} entered production`,
    );
    return this.sendMail({ to: params.to, subject, html });
  }

  async sendOrderShipped(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
    trackingCode?: string;
    trackingUrl?: string;
    carrier?: string;
    deliveryDays?: number;
  }) {
    const { subject, html } = await this.renderFromDb(
      'order-shipped',
      {
        name_client: params.customerName,
        numero_order: params.orderNumber,
        codigo_rastreio: params.trackingCode ?? '',
        url_rastreio: params.trackingUrl ?? '',
        transportadora: params.carrier ?? '',
        prazo_dias: params.deliveryDays ? String(params.deliveryDays) : '',
        url_order: this.orderUrl(params.orderId),
      },
      () =>
        Promise.resolve(
          `<h2>Order ${escapeHtml(params.orderNumber)} shipped!</h2>
          <p>Hello, ${escapeHtml(params.customerName)}! Your order is on its way${params.carrier ? ` via ${escapeHtml(params.carrier)}` : ''}.</p>
          ${params.trackingCode
            ? `<p><strong>Tracking:</strong> ${escapeHtml(params.trackingCode)}</p>`
            : ''
          }
          ${params.trackingUrl
            ? `<p><a href="${escapeHtml(params.trackingUrl)}">Track your order</a></p>`
            : ''
          }`,
        ),
      `Order ${params.orderNumber} shipped`,
    );
    return this.sendMail({ to: params.to, subject, html });
  }

  async sendOrderDelivered(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'order-delivered',
      {
        name_client: params.customerName,
        numero_order: params.orderNumber,
        url_order: this.orderUrl(params.orderId),
      },
      () =>
        Promise.resolve(
          `<h2>Order ${escapeHtml(params.orderNumber)} delivered 🎉</h2>
          <p>Hello, ${escapeHtml(params.customerName)}! Your order has arrived. We hope you love your miniatures.</p>
          <p><a href="${escapeHtml(this.orderUrl(params.orderId))}">View order</a></p>`,
        ),
      `Order ${params.orderNumber} delivered`,
    );
    return this.sendMail({ to: params.to, subject, html });
  }

  async sendOrderCancelled(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
    reason?: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'order-cancelled',
      {
        name_client: params.customerName,
        numero_order: params.orderNumber,

        motivo: params.reason ? `: ${params.reason}` : '',
        url_order: this.orderUrl(params.orderId),
      },
      () =>
        Promise.resolve(
          `<h2>Order ${escapeHtml(params.orderNumber)} cancelled</h2>
          <p>Hello, ${escapeHtml(params.customerName)}. Your order was cancelled${params.reason ? `: ${escapeHtml(params.reason)}` : ''}.</p>
          <p>If you have any questions, please reply to this email.</p>`,
        ),
      `Order ${params.orderNumber} cancelled`,
    );
    return this.sendMail({ to: params.to, subject, html });
  }

  async sendOrderRefunded(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    orderId: string;
    reason?: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'order-refunded',
      {
        name_client: params.customerName,
        numero_order: params.orderNumber,

        motivo: params.reason ? `: ${params.reason}` : '',
        url_order: this.orderUrl(params.orderId),
      },
      () =>
        Promise.resolve(
          `<h2>Order ${escapeHtml(params.orderNumber)} refunded</h2>
          <p>Hello, ${escapeHtml(params.customerName)}. We received your order refund${params.reason ? ` (${escapeHtml(params.reason)})` : ''}. The refund is being processed.</p>`,
        ),
      `Order ${params.orderNumber} refunded`,
    );
    return this.sendMail({ to: params.to, subject, html });
  }

  async sendPasswordReset(params: {
    to: string;
    name: string;
    resetUrl: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'password-reset',
      {
        name_client: params.name,
        url_redefinicao: params.resetUrl,
      },
      () =>
        render(
          PasswordResetEmail({ name: params.name, resetUrl: params.resetUrl }),
        ),
      'Reset password — RedFigure',
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendLoginCode(params: {
    to: string;
    name: string;
    code: string;
    purpose: 'LOGIN' | 'CLAIM';
  }) {
    const isLogin = params.purpose === 'LOGIN';
    const subjectFallback = isLogin
      ? 'Your access code — RedFigure'
      : 'Active your account — RedFigure';
    const { subject, html } = await this.renderFromDb(
      'login-code',
      {
        name_client: params.name,
        codigo: params.code,
        proposito: params.purpose,
      },
      () =>
        render(
          LoginCodeEmail({
            name: params.name,
            code: params.code,
            purpose: params.purpose,
          }),
        ),
      subjectFallback,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendLowStockAlert(params: {
    to: string;
    productName: string;
    currentStock: number;
    threshold: number;
    variationName?: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'low-stock-alert',
      {
        name_product: params.productName,
        stock_atual: String(params.currentStock),
        limite_stock: String(params.threshold),
        name_variation: params.variationName ?? '',
      },
      () =>
        Promise.resolve(
          `<h2>Low Stock Alert</h2>
          <p>The product <strong>${escapeHtml(params.productName)}</strong> is running low on stock.</p>
          <p>Current stock: <strong>${params.currentStock}</strong> units (limit: ${params.threshold})</p>`,
        ),
      `⚠️ Low stock: ${params.productName}`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendReviewRequest(params: {
    to: string;
    customerName: string;
    reviewUrl: string;
    discountPercent: number;
    discountLabel?: string;
    couponValidityDays: number;
    unsubscribeUrl?: string;
    unsubscribeOneClickUrl?: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'review-request',
      {
        name_client: params.customerName,
        link_avaliacao: params.reviewUrl,
        percentual_desconto: String(params.discountPercent),
        valor_desconto: params.discountLabel ?? `${params.discountPercent}%`,
        validade_dias: String(params.couponValidityDays),
        url_unsubscribe: params.unsubscribeUrl ?? '',
      },
      () => render(ReviewRequestEmail(params)),
      `Rate your order and get a discount`,
    );

    return this.sendMail({
      to: params.to,
      subject,
      html,
      unsubscribeOneClickUrl: params.unsubscribeOneClickUrl,
    });
  }

  async sendReviewReminder(params: {
    to: string;
    customerName: string;
    reviewUrl: string;
    discountPercent: number;
    discountLabel?: string;
    couponValidityDays: number;
    unsubscribeUrl?: string;
    unsubscribeOneClickUrl?: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'review-reminder',
      {
        name_client: params.customerName,
        link_avaliacao: params.reviewUrl,
        percentual_desconto: String(params.discountPercent),
        valor_desconto: params.discountLabel ?? `${params.discountPercent}%`,
        validade_dias: String(params.couponValidityDays),
        url_unsubscribe: params.unsubscribeUrl ?? '',
      },
      () => render(ReviewReminderEmail(params)),
      `Reminder: your discount coupon awaits you`,
    );

    return this.sendMail({
      to: params.to,
      subject,
      html,
      unsubscribeOneClickUrl: params.unsubscribeOneClickUrl,
    });
  }

  async sendContactMessage(params: {
    to: string;
    name: string;
    email: string;
    message: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const subject = `[Contact] ${params.name}`;
    let html: string;
    try {
      html = await render(
        ContactEmail({
          name: params.name,
          email: params.email,
          message: params.message,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        }),
      );
    } catch (err) {

      this.logger.warn(
        `ContactEmail render failed, using fallback HTML: ${err instanceof Error ? err.message : String(err)}`,
      );
      html = `<h2>New contact message</h2>
      <p><strong>From:</strong> ${escapeHtml(params.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(params.email)}</p>
      <p><strong>Message:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(params.message)}</pre>
      ${params.ipAddress ? `<p style="color:#888;font-size:12px">IP: ${escapeHtml(params.ipAddress)}</p>` : ''}
      ${params.userAgent ? `<p style="color:#888;font-size:12px">UA: ${escapeHtml(params.userAgent)}</p>` : ''}`;
    }

    return this.transporter.sendMail({
      from: this.from,
      to: params.to,

      replyTo: params.email,
      subject,
      html,
    });
  }

  async sendReviewReward(params: {
    to: string;
    customerName: string;
    productName: string;
    couponCode: string;
    discountPercent: number;
  }) {
    const { subject, html } = await this.renderFromDb(
      'review-reward',
      {
        name_client: params.customerName,
        name_product: params.productName,
        codigo_cupom: params.couponCode,
        percentual_desconto: String(params.discountPercent),
      },
      () => render(ReviewRewardEmail(params)),
      `You won ${params.discountPercent}% discount!`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendProductQuestionReceived(params: {
    to: string;
    productName: string;
    productSlug: string;
    questionId: string;
    askerName: string;
    askerEmail: string;
    question: string;
    ipAddress?: string;
  }) {
    const subject = `[Pergunta] ${params.productName}: ${params.askerName}`;
    const productAdminUrl = `${this.storeUrl}/admin/questions?status=PENDING`;

    let html: string;
    try {
      html = await render(
        ProductQuestionReceivedEmail({
          productName: params.productName,
          productAdminUrl,
          askerName: params.askerName,
          askerEmail: params.askerEmail,
          question: params.question,
          ipAddress: params.ipAddress,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `ProductQuestionReceivedEmail render failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      html = `<h2>New question</h2>
      <p><strong>Product:</strong> ${escapeHtml(params.productName)}</p>
      <p><strong>From:</strong> ${escapeHtml(params.askerName)} (${escapeHtml(params.askerEmail)})</p>
      <p><strong>Question:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(params.question)}</pre>
      <p><a href="${escapeHtml(productAdminUrl)}">Answer in panel</a></p>`;
    }

    return this.transporter.sendMail({
      from: this.from,
      to: params.to,

      replyTo: params.askerEmail,
      subject,
      html,
    });
  }

  async sendProductQuestionAnswered(params: {
    to: string;
    askerName: string;
    productName: string;
    productSlug: string;
    question: string;
    answer: string;
  }) {
    const subject = `Your question about "${params.productName}" has been answered`;
    const productPublicUrl = `${this.storeUrl}/p/${params.productSlug}#sec-qa`;

    let html: string;
    try {
      html = await render(
        ProductQuestionAnsweredEmail({
          askerName: params.askerName,
          productName: params.productName,
          productPublicUrl,
          question: params.question,
          answer: params.answer,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `ProductQuestionAnsweredEmail render failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      html = `<h2>Hello, ${escapeHtml(params.askerName)}!</h2>
      <p>We answered your question about <strong>${escapeHtml(params.productName)}</strong>:</p>
      <p><em>${escapeHtml(params.question)}</em></p>
      <p><strong>Answer:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(params.answer)}</pre>
      <p><a href="${escapeHtml(productPublicUrl)}">See on the product page</a></p>`;
    }

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendCustomQuoteRequestAdmin(params: {
    to: string | string[];
    quoteNumber: string;
    quoteId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    description: string;
    externalLinks: string[];
  }) {
    const subject = `[Quote] ${params.quoteNumber} — ${params.customerName}`;
    const quoteAdminUrl = `${this.storeUrl}/admin/quotes/${params.quoteId}`;

    let html: string;
    try {
      html = await render(
        CustomQuoteRequestAdminEmail({
          quoteNumber: params.quoteNumber,
          quoteAdminUrl,
          customerName: params.customerName,
          customerEmail: params.customerEmail,
          customerPhone: params.customerPhone,
          description: params.description,
          externalLinks: params.externalLinks,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `CustomQuoteRequestAdminEmail render failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      const linksHtml = params.externalLinks
        .map((u) => `<li><a href="${escapeHtml(u)}">${escapeHtml(u)}</a></li>`)
        .join('');
      html = `<h2>New quote ${escapeHtml(params.quoteNumber)}</h2>
      <p><strong>Customer:</strong> ${escapeHtml(params.customerName)} (${escapeHtml(params.customerEmail)})</p>
      ${params.customerPhone ? `<p><strong>Phone:</strong> ${escapeHtml(params.customerPhone)}</p>` : ''}
      <p><strong>Description:</strong></p>
      <pre style="white-space:pre-wrap">${escapeHtml(params.description)}</pre>
      ${linksHtml ? `<p><strong>Links:</strong></p><ul>${linksHtml}</ul>` : ''}
      <p><a href="${escapeHtml(quoteAdminUrl)}">Open in panel</a></p>`;
    }

    return this.transporter.sendMail({
      from: this.from,
      to: params.to,
      replyTo: params.customerEmail,
      subject,
      html,
    });
  }

  async sendCustomQuoteSentCustomer(params: {
    to: string;
    customerName: string;
    quoteNumber: string;
    token: string;
    items: Array<{ name: string; unitPrice: number }>;
    expiresAt: string;
  }) {
    const subject = `Your quote ${params.quoteNumber} is ready`;
    const quoteUrl = `${this.storeUrl}/quote/${params.token}`;
    const expiresDate = new Date(params.expiresAt);
    const expiresAtFormatted = expiresDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    let html: string;
    try {
      html = await render(
        CustomQuoteSentCustomerEmail({
          customerName: params.customerName,
          quoteNumber: params.quoteNumber,
          quoteUrl,
          items: params.items,
          expiresAtFormatted,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `CustomQuoteSentCustomerEmail render failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      const itemsHtml = params.items
        .map(
          (i) =>
            `<li>${escapeHtml(i.name)} — ${escapeHtml(formatCurrency(i.unitPrice))} VND</li>`,
        )
        .join('');
      html = `<h2>Hello, ${escapeHtml(params.customerName)}!</h2>
      <p>Your quote <strong>${escapeHtml(params.quoteNumber)}</strong> is ready.</p>
      <ul>${itemsHtml}</ul>
      <p><strong>Expires on:</strong> ${escapeHtml(expiresAtFormatted)}</p>
      <p><a href="${escapeHtml(quoteUrl)}">View my quote</a></p>`;
    }

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendCartAbandonmentFirst(params: {
    to: string;
    customerName: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    cartUrl: string;
    unsubscribeUrl: string;
    unsubscribeOneClickUrl: string;
    cartId: string;
    cycleKey: number;
  }) {

    if (await this.cartCycleChanged(params.cartId, params.cycleKey)) {
      this.logger.log(
        `Cart ${params.cartId} changed after 1st enqueue - skipping`,
      );
      return { skipped: true, reason: 'cart_modified' as const };
    }

    const itemsHtml = this.buildItemsHtml(params.items);
    const { subject, html } = await this.renderFromDb(
      'cart-abandonment-first',
      {
        name_client: params.customerName,
        itens_cart: itemsHtml,
        link_cart: params.cartUrl,
        total_cart: formatCurrency(params.total),
        name_store: 'RedFigure',
        link_unsubscribe: params.unsubscribeUrl,
      },
      () =>
        Promise.resolve(
          `<h2>Hello, ${escapeHtml(params.customerName)}</h2>
          <p>Your cart is waiting for you:</p>
          ${itemsHtml}
          <p><strong>Total: ${escapeHtml(formatCurrency(params.total))} VND</strong></p>
          <p><a href="${escapeHtml(params.cartUrl)}">Back to cart</a></p>
          <hr><p style="font-size:11px;color:#888"><a href="${escapeHtml(params.unsubscribeUrl)}">Unsubscribe from these emails</a></p>`,
        ),
      'You forgot something in the cart',
    );

    return this.sendMail({
      to: params.to,
      subject,
      html,
      unsubscribeOneClickUrl: params.unsubscribeOneClickUrl,
    });
  }

  async sendCartAbandonmentSecond(params: {
    to: string;
    customerName: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    cartUrl: string;
    unsubscribeUrl: string;
    unsubscribeOneClickUrl: string;
    couponCode: string;
    couponLabel: string;
    couponValidUntil: Date;
    cartId: string;
    cycleKey: number;
  }) {
    if (await this.cartCycleChanged(params.cartId, params.cycleKey)) {
      this.logger.log(
        `Cart ${params.cartId} changed after 2nd enqueue - skipping (coupon ${params.couponCode} still valid)`,
      );
      return { skipped: true, reason: 'cart_modified' as const };
    }

    const itemsHtml = this.buildItemsHtml(params.items);
    const validUntilFormatted = this.formatDateTime(params.couponValidUntil);
    const { subject, html } = await this.renderFromDb(
      'cart-abandonment-second',
      {
        name_client: params.customerName,
        itens_cart: itemsHtml,
        link_cart: params.cartUrl,
        total_cart: formatCurrency(params.total),
        name_store: 'RedFigure',
        cupom_codigo: params.couponCode,
        cupom_valor: params.couponLabel,
        cupom_validade: validUntilFormatted,
        link_unsubscribe: params.unsubscribeUrl,
      },
      () =>
        Promise.resolve(
          `<h2>Hello, ${escapeHtml(params.customerName)}</h2>
          <p>Your cart is still waiting — and we’ve set aside a coupon for you:</p>
          <p><strong>Coupon: ${escapeHtml(params.couponCode)}</strong> (${escapeHtml(params.couponLabel)} discount)</p>
          <p>Valid until ${escapeHtml(validUntilFormatted)}</p>
          ${itemsHtml}
          <p><strong>Total: ${escapeHtml(formatCurrency(params.total))} VND</strong></p>
          <p><a href="${escapeHtml(params.cartUrl)}">Apply coupon and finish</a></p>
          <hr><p style="font-size:11px;color:#888"><a href="${escapeHtml(params.unsubscribeUrl)}">Unsubscribe from these emails</a></p>`,
        ),
      `${params.couponLabel} discount to finish your order`,
    );

    return this.sendMail({
      to: params.to,
      subject,
      html,
      unsubscribeOneClickUrl: params.unsubscribeOneClickUrl,
    });
  }
  async sendNewsletterConfirm(params: { to: string; confirmUrl: string }) {
    const { subject, html } = await this.renderFromDb(
      'newsletter-confirm',
      {
        link_confirmar: params.confirmUrl,
        email_cliente: params.to,
      },
      () => render(NewsletterConfirmEmail({ confirmUrl: params.confirmUrl })),
      'Xác nhận đăng ký nhận bản tin RedFigure',
    );

    return this.sendMail({ to: params.to, subject, html });
  }
  async sendCampaign(params: {
    to: string;
    subject: string;
    html: string;
    unsubscribeOneClickUrl?: string;
  }) {
    const safeHtml = sanitizeHtml(params.html, CAMPAIGN_HTML_ALLOWLIST);
    return this.sendMail({
      to: params.to,
      subject: params.subject,
      html: safeHtml,
      unsubscribeOneClickUrl: params.unsubscribeOneClickUrl,
    });
  }
}

const CAMPAIGN_HTML_ALLOWLIST: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'span',
    'div',
    'a',
    'img',
    'strong',
    'em',
    'b',
    'i',
    'u',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'hr',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'style'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    '*': ['style', 'class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['https'],
  },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb/, /^[a-z]+$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb/, /^[a-z]+$/i],
      'text-align': [/^(left|right|center|justify)$/],
      'font-size': [/^\d+(?:px|em|rem|%|pt)$/],
      'font-weight': [/^(normal|bold|\d{3})$/],
      'font-style': [/^(normal|italic)$/],
      'text-decoration': [/^(none|underline|line-through)$/],
      margin: [/^[\d.\s]+(?:px|em|rem|%)?$/],
      padding: [/^[\d.\s]+(?:px|em|rem|%)?$/],
      width: [/^\d+(?:px|%)$/],
      height: [/^\d+(?:px|%)$/],
    },
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer',
    }),
  },
};