import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { escapeHtml } from './escape-html';

const HTML_TAGS = new Set(['order_items', 'shopping_cart', 'tracking_section']);

@Injectable()
export class EmailTemplateService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll() {
    return this.prisma.emailTemplate.findMany({
      orderBy: { type: 'asc' },
    });
  }

  async findByType(type: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { type },
    });

    if (!template) {
      throw new NotFoundException(`Email template '${type}' not found`);
    }

    return template;
  }

  async update(id: string, data: { subject?: string; htmlBody?: string }) {
    return this.prisma.emailTemplate.update({
      where: { id },
      data,
    });
  }

  renderTemplate(
    template: { subject: string; htmlBody: string },
    variables: Record<string, string>,
  ): { subject: string; html: string } {
    let subject = template.subject;
    let html = template.htmlBody;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const safeValue = HTML_TAGS.has(key) ? value : escapeHtml(value);

      subject = subject.replaceAll(placeholder, safeValue);
      html = html.replaceAll(placeholder, safeValue);
    }

    return { subject, html };
  }

  getSampleData(type: string): Record<string, string> {
    const base: Record<string, string> = {
      name_client: 'Maria Silva',
      email_client: 'maria@exemplo.com',
      store_url: 'https://redfigure.com',
    };

    const samples: Record<string, Record<string, string>> = {
      welcome: {},
      'order-confirmation': {
        order_number: 'ORD-20260405-TESTE',
        order_items: `
          <div style="padding:8px 0;display:flex;justify-content:space-between">
            <span style="color:#1a1a2e;font-size:14px">Miniatura Elf × 2</span>
            <span style="color:#1a1a2e;font-size:14px">99,000 VND</span>
          </div>
          <div style="padding:8px 0;display:flex;justify-content:space-between">
            <span style="color:#1a1a2e;font-size:14px">Kit Dragon × 1</span>
            <span style="color:#1a1a2e;font-size:14px">129,000 VND</span>
          </div>`,
        subtotal: '229,000 VND',
        shipping: '10,000 VND',
        desconto: '-10,000 VND',
        total: '229,000 VND',
      },
      'status-change': {
        order_number: 'ORD-20260405-TESTE',
        status_label: 'Đã gửi',
        status_description: 'Đơn hàng của bạn đã được gửi và đang trên đường!',
        tracking_section: `
          <div style="background:#f6f9fc;border-radius:6px;padding:12px 16px;margin:16px 0">
            <p style="font-size:12px;color:#8898aa;text-transform:uppercase;margin:0 0 4px">Mã vận chuyển</p>
            <p style="font-size:20px;color:#1a1a2e;font-weight:bold;font-family:monospace;margin:0">VN123456789XX</p>
          </div>`,
        tracking_code: 'VN123456789XX',
      },
      'password-reset': {
        reset_url:
          'https://redfigure.com/reset-password?token=example-token',
      },
      'review-request': {
        review_url:
          'https://redfigure.com/review/token-example-abc123',
        discount_value: '10%',
        discount_percent: '10',
        validity_days: '30',
      },
      'review-reminder': {
        review_url:
          'https://redfigure.com/review/token-example-abc123',
        discount_value: '10%',
        discount_percent: '10',
        validity_days: '30',
      },
      'review-reward': {
        product_name: 'Miniatura Dragon',
        coupon_code: 'REVIEW-TESTE10',
        discount_percent: '10',
      },
      'low-stock-alert': {
        product_name: 'Miniatura Elf',
        stock_actual: '3',
        stock_limit: '5',
        variant_name: '',
      },
    };

    return { ...base, ...(samples[type] ?? {}) };
  }
}
