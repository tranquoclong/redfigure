import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: any;
  let emailTemplateService: EmailTemplateService;

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'msg1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                SMTP_HOST: 'smtp.test.com',
                SMTP_PORT: '587',
                SMTP_USER: 'test@test.com',
                SMTP_PASSWORD: 'pass',
                SMTP_FROM: 'noreply@redfigure.com',
                FRONTEND_URL: 'https://redfigure.com',
              };
              return config[key];
            }),
          },
        },
        {
          provide: EmailTemplateService,
          useValue: {
            findByType: jest.fn(),
            renderTemplate: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            cart: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    emailTemplateService =
      module.get<EmailTemplateService>(EmailTemplateService);
    (service as any).transporter = mockTransporter;
  });

  describe('sendMail', () => {
    it('should send email with correct parameters', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Welcome',
        html: '<h1>Welcome!</h1>',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Welcome',
          html: '<h1>Welcome!</h1>',
        }),
      );
    });

    it('should use configured from address', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@redfigure.com',
        }),
      );
    });

    it('should add RFC 8058 headers when unsubscribeOneClickUrl is passed', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Promo',
        html: '<p>oi</p>',
        unsubscribeOneClickUrl:
          'https://api.redfigure.com/api/v1/users/unsubscribe/one-click?t=tok',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'List-Unsubscribe':
              '<https://api.redfigure.com/api/v1/users/unsubscribe/one-click?t=tok>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      );
    });

    it('should not add RFC 8058 headers when URL is not passed (transactional emails)', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Payment approved',
        html: '<p>order</p>',
      });

      const args = mockTransporter.sendMail.mock.calls[0][0];
      expect(args.headers).toBeUndefined();
    });
  });

  describe('sendWelcome — DB template', () => {
    it('should use DB template when available', async () => {
      const dbTemplate = {
        id: 'tpl1',
        type: 'welcome',
        subject: 'Hello {{customer_name}}!',
        htmlBody: '<h1>Hello {{customer_name}}</h1>',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(
        dbTemplate,
      );
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: 'Hello John!',
        html: '<h1>Hello John</h1>',
      });

      await service.sendWelcome({ to: 'user@example.com', name: 'John' });

      expect(emailTemplateService.findByType).toHaveBeenCalledWith('welcome');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Hello John!',
          html: '<h1>Hello John</h1>',
        }),
      );
    });

    it('should fallback to React Email when DB template not found', async () => {
      (emailTemplateService.findByType as jest.Mock).mockRejectedValue(
        new NotFoundException(),
      );

      await service.sendWelcome({ to: 'user@example.com', name: 'John' });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          html: expect.stringContaining('John'),
        }),
      );
    });
  });

  describe('status-change emails (5 specific templates)', () => {
    beforeEach(() => {
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue({
        type: 'x',
        subject: 'x',
        htmlBody: 'x',
        isActive: true,
      });
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: 'x',
        html: 'x',
      });
    });

    it('sendOrderInProduction passes order URL', async () => {
      await service.sendOrderInProduction({
        to: 'u@x.com',
        customerName: 'Ana',
        orderNumber: 'ORD-1',
        orderId: 'order-abc',
      });
      const vars = (emailTemplateService.renderTemplate as jest.Mock).mock
        .calls[0][1];
      expect(vars.order_url).toContain('/my-account/orders/order-abc');
      expect(emailTemplateService.findByType).toHaveBeenCalledWith(
        'order-in-production',
      );
    });

    it('sendOrderShipped passes tracking info', async () => {
      await service.sendOrderShipped({
        to: 'u@x.com',
        customerName: 'Ana',
        orderNumber: 'ORD-1',
        orderId: 'order-abc',
        trackingCode: 'VN123',
        trackingUrl: 'https://rastreio.x/VN123',
        carrier: 'Correios',
        deliveryDays: 7,
      });
      const vars = (emailTemplateService.renderTemplate as jest.Mock).mock
        .calls[0][1];
      expect(vars.tracking_code).toBe('VN123');
      expect(vars.tracking_url).toBe('https://rastreio.x/VN123');
      expect(vars.carrier).toBe('Correios');
      expect(vars.delivery_days).toBe('7');
      expect(emailTemplateService.findByType).toHaveBeenCalledWith(
        'order-shipped',
      );
    });

    it('sendOrderShipped handles missing tracking fields gracefully', async () => {
      await service.sendOrderShipped({
        to: 'u@x.com',
        customerName: 'Ana',
        orderNumber: 'ORD-1',
        orderId: 'order-abc',
      });
      const vars = (emailTemplateService.renderTemplate as jest.Mock).mock
        .calls[0][1];
      expect(vars.tracking_code).toBe('');
      expect(vars.tracking_url).toBe('');
      expect(vars.carrier).toBe('');
      expect(vars.delivery_days).toBe('');
    });

    it('sendOrderDelivered dispatches to DB template', async () => {
      await service.sendOrderDelivered({
        to: 'u@x.com',
        customerName: 'Ana',
        orderNumber: 'ORD-1',
        orderId: 'order-abc',
      });
      expect(emailTemplateService.findByType).toHaveBeenCalledWith(
        'order-delivered',
      );
    });

    it('sendOrderCancelled formats the reason with ": " separator to fit the template', async () => {
      await service.sendOrderCancelled({
        to: 'u@x.com',
        customerName: 'Ana',
        orderNumber: 'ORD-1',
        orderId: 'order-abc',
        reason: 'Payment expired',
      });
      const vars = (emailTemplateService.renderTemplate as jest.Mock).mock
        .calls[0][1];

      expect(vars.reason).toBe(': Payment expired');
      expect(emailTemplateService.findByType).toHaveBeenCalledWith(
        'order-cancelled',
      );
    });

    it('sendOrderCancelled without reason leaves the reason empty', async () => {
      await service.sendOrderCancelled({
        to: 'u@x.com',
        customerName: 'Ana',
        orderNumber: 'ORD-1',
        orderId: 'order-abc',
      });
      const vars = (emailTemplateService.renderTemplate as jest.Mock).mock
        .calls[0][1];
      expect(vars.reason).toBe('');
    });

    it('sendOrderRefunded formats the reason like cancelled', async () => {
      await service.sendOrderRefunded({
        to: 'u@x.com',
        customerName: 'Ana',
        orderNumber: 'ORD-1',
        orderId: 'order-abc',
        reason: 'Product arrived damaged',
      });
      const vars = (emailTemplateService.renderTemplate as jest.Mock).mock
        .calls[0][1];
      expect(vars.reason).toBe(': Product arrived damaged');
    });

    it('sendOrderRefunded dispatches to DB template', async () => {
      await service.sendOrderRefunded({
        to: 'u@x.com',
        customerName: 'Ana',
        orderNumber: 'ORD-1',
        orderId: 'order-abc',
      });
      expect(emailTemplateService.findByType).toHaveBeenCalledWith(
        'order-refunded',
      );
    });
  });

  describe('sendPasswordReset — DB template', () => {
    it('should use DB template with reset URL', async () => {
      const dbTemplate = {
        type: 'password-reset',
        subject: 'Reset Password',
        htmlBody: '<a href="{{reset_url}}">Reset</a>',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(
        dbTemplate,
      );
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: 'Reset Password',
        html: '<a href="https://example.com/reset">Reset</a>',
      });

      await service.sendPasswordReset({
        to: 'user@example.com',
        name: 'Carlos',
        resetUrl: 'https://example.com/reset',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('reset'),
        }),
      );
    });
  });

  describe('sendLowStockAlert — DB template', () => {
    it('should use DB template with product info', async () => {
      const dbTemplate = {
        type: 'low-stock-alert',
        subject: 'Low stock: {{product_name}}',
        htmlBody: '<p>{{product_name}} — {{current_stock}} units</p>',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(
        dbTemplate,
      );
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: 'Low stock: Dragon',
        html: '<p>Dragon — 2 units</p>',
      });

      await service.sendLowStockAlert({
        to: 'admin@example.com',
        productName: 'Dragon',
        currentStock: 2,
        threshold: 5,
      });

      expect(emailTemplateService.findByType).toHaveBeenCalledWith(
        'low-stock-alert',
      );
      expect(emailTemplateService.renderTemplate).toHaveBeenCalledWith(
        dbTemplate,
        expect.objectContaining({
          product_name: 'Dragon',
          current_stock: '2',
          threshold: '5',
        }),
      );
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: 'Low stock: Dragon',
        }),
      );
    });

    it('should include variation name when provided', async () => {
      const dbTemplate = {
        type: 'low-stock-alert',
        subject: 'Low stock: {{product_name}}',
        htmlBody: '<p>{{product_name}} — {{variation_name}}</p>',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(
        dbTemplate,
      );
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: 'Low stock: Dragon - Red',
        html: '<p>Dragon - Red</p>',
      });

      await service.sendLowStockAlert({
        to: 'admin@example.com',
        productName: 'Dragon - Red',
        currentStock: 1,
        threshold: 5,
        variationName: 'Red',
      });

      expect(emailTemplateService.renderTemplate).toHaveBeenCalledWith(
        dbTemplate,
        expect.objectContaining({
          variation_name: 'Red',
        }),
      );
    });
  });

  describe('sendReviewReward — DB template', () => {
    it('should use DB template with coupon code', async () => {
      const dbTemplate = {
        type: 'review-reward',
        subject: '{{discount_percent}}% off!',
        htmlBody: '<p>Coupon: {{coupon_code}}</p>',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(
        dbTemplate,
      );
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: '5% off!',
        html: '<p>Coupon: REVIEW-XYZ</p>',
      });

      await service.sendReviewReward({
        to: 'user@example.com',
        customerName: 'Maria',
        productName: 'Dragon',
        couponCode: 'REVIEW-XYZ',
        discountPercent: 5,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '5% off!',
          html: expect.stringContaining('REVIEW-XYZ'),
        }),
      );
    });
  });

  describe('staging allowlist', () => {
    async function createServiceWithConfig(
      extra: Record<string, string | undefined>,
    ) {
      const transporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'm-stg' }),
      };
      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string | undefined> = {
                  SMTP_HOST: 'smtp.test.com',
                  SMTP_PORT: '587',
                  SMTP_USER: 'u',
                  SMTP_PASSWORD: 'p',
                  SMTP_FROM: 'noreply@redfigure.com',
                  FRONTEND_URL: 'https://redfigure.com',
                  ...extra,
                };
                return config[key];
              }),
            },
          },
          {
            provide: EmailTemplateService,
            useValue: {
              findByType: jest.fn(),
              renderTemplate: jest.fn(),
            },
          },
          {
            provide: PrismaService,
            useValue: { cart: { findUnique: jest.fn() } },
          },
        ],
      }).compile();
      const svc = module.get<EmailService>(EmailService);
      (svc as any).transporter = transporter;
      return { svc, transporter };
    }

    it('in staging, BLOCKS sending to recipient outside allowlist', async () => {
      const { svc, transporter } = await createServiceWithConfig({
        NODE_ENV: 'staging',
        STAGING_EMAIL_ALLOWLIST: 'alice@test.com,bob@test.com',
      });
      const result = await svc.sendMail({
        to: 'eve@external.com',
        subject: 'X',
        html: '<p>x</p>',
      });
      expect(transporter.sendMail).not.toHaveBeenCalled();
      expect(result).toMatchObject({ skipped: true });
    });

    it('in staging, sends when recipient is in allowlist', async () => {
      const { svc, transporter } = await createServiceWithConfig({
        NODE_ENV: 'staging',
        STAGING_EMAIL_ALLOWLIST: 'alice@test.com,bob@test.com',
      });
      await svc.sendMail({
        to: 'alice@test.com',
        subject: 'X',
        html: '<p>x</p>',
      });
      expect(transporter.sendMail).toHaveBeenCalled();
    });

    it('case-insensitive + trim in allowlist and in recipient', async () => {
      const { svc, transporter } = await createServiceWithConfig({
        NODE_ENV: 'staging',
        STAGING_EMAIL_ALLOWLIST: '  Alice@TEST.com , bob@test.com ',
      });
      await svc.sendMail({
        to: '  ALICE@test.com  ',
        subject: 'X',
        html: '<p>x</p>',
      });
      expect(transporter.sendMail).toHaveBeenCalled();
    });

    it('in production, allowlist is IGNORED (sends to any recipient)', async () => {
      const { svc, transporter } = await createServiceWithConfig({
        NODE_ENV: 'production',
        STAGING_EMAIL_ALLOWLIST: 'alice@test.com',
      });
      await svc.sendMail({
        to: 'eve@external.com',
        subject: 'X',
        html: '<p>x</p>',
      });
      expect(transporter.sendMail).toHaveBeenCalled();
    });

    it('staging without allowlist = pass-through (backward compat)', async () => {
      const { svc, transporter } = await createServiceWithConfig({
        NODE_ENV: 'staging',
        STAGING_EMAIL_ALLOWLIST: undefined,
      });
      await svc.sendMail({
        to: 'anyone@anywhere.com',
        subject: 'X',
        html: '<p>x</p>',
      });
      expect(transporter.sendMail).toHaveBeenCalled();
    });

    it('multi-recipient blocks if ANY recipient is not in allowlist (fail-closed)', async () => {
      const { svc, transporter } = await createServiceWithConfig({
        NODE_ENV: 'staging',
        STAGING_EMAIL_ALLOWLIST: 'alice@test.com',
      });
      const result = await svc.sendMail({
        to: 'alice@test.com,eve@external.com',
        subject: 'X',
        html: '<p>x</p>',
      });
      expect(transporter.sendMail).not.toHaveBeenCalled();
      expect(result).toMatchObject({ skipped: true });
    });

    it('NODE_ENV undefined + allowlist set = apply filter (defensive)', async () => {

      const { svc, transporter } = await createServiceWithConfig({
        NODE_ENV: undefined,
        STAGING_EMAIL_ALLOWLIST: 'alice@test.com',
      });
      await svc.sendMail({
        to: 'eve@external.com',
        subject: 'X',
        html: '<p>x</p>',
      });
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });
  });
});
