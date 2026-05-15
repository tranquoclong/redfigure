import { Test, TestingModule } from '@nestjs/testing';
import { EmailTemplateService } from './email-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;
  let prisma: PrismaService;

  const mockTemplate = {
    id: 'tpl1',
    type: 'welcome',
    subject: 'Welcome, {{customer_name}}!',
    htmlBody: '<h1>Hello, {{customer_name}}!</h1><p>Email: {{customer_email}}</p>',
    availableTags: JSON.stringify([
      { tag: 'customer_name', description: 'Customer Name' },
      { tag: 'customer_email', description: 'Customer Email' },
    ]),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTemplateService,
        {
          provide: PrismaService,
          useValue: {
            emailTemplate: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EmailTemplateService>(EmailTemplateService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    it('should return all templates', async () => {
      (prisma.emailTemplate.findMany as jest.Mock).mockResolvedValue([
        mockTemplate,
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('welcome');
    });
  });

  describe('findByType', () => {
    it('should return template by type', async () => {
      (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(
        mockTemplate,
      );

      const result = await service.findByType('welcome');

      expect(result.type).toBe('welcome');
    });

    it('should throw NotFoundException when template not found', async () => {
      (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findByType('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update subject and htmlBody', async () => {
      const updated = {
        ...mockTemplate,
        subject: 'New Subject',
        htmlBody: '<h1>New Body</h1>',
      };
      (prisma.emailTemplate.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.update('tpl1', {
        subject: 'New Subject',
        htmlBody: '<h1>New Body</h1>',
      });

      expect(result.subject).toBe('New Subject');
      expect(prisma.emailTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl1' },
        data: { subject: 'New subject', htmlBody: '<h1>New body</h1>' },
      });
    });
  });

  describe('renderTemplate', () => {
    it('should replace all tags in subject and body', () => {
      const result = service.renderTemplate(mockTemplate, {
        customer_name: 'John Doe',
        customer_email: 'john@email.com',
      });

      expect(result.subject).toBe('Welcome, John Doe!');
      expect(result.html).toContain('Hello, John Doe!');
      expect(result.html).toContain('Email: john@email.com');
    });

    it('should leave unknown tags untouched', () => {
      const result = service.renderTemplate(mockTemplate, {
        customer_name: 'Maria',
      });

      expect(result.subject).toContain('Maria');
      expect(result.html).toContain('{{customer_email}}');
    });

    it('should handle empty variables gracefully', () => {
      const result = service.renderTemplate(mockTemplate, {});

      expect(result.subject).toBe('Welcome, {{customer_name}}!');
      expect(result.html).toContain('{{customer_name}}');
    });

    it('should escape HTML in variable values to prevent XSS', () => {
      const result = service.renderTemplate(mockTemplate, {
        customer_name: '<script>alert("xss")</script>',
        customer_email: 'safe@email.com',
      });

      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
    });

    it('should NOT escape HTML in special HTML tags (order_items, tracking_section)', () => {
      const tpl = {
        ...mockTemplate,
        htmlBody: '<div>{{order_items}}</div>',
      };

      const result = service.renderTemplate(tpl, {
        order_items: '<table><tr><td>Item 1</td></tr></table>',
      });

      expect(result.html).toContain('<table><tr><td>Item 1</td></tr></table>');
    });
  });

  describe('getSampleData', () => {
    it('should return sample variables for welcome type', () => {
      const data = service.getSampleData('welcome');
      expect(data).toHaveProperty('customer_name');
      expect(data).toHaveProperty('customer_email');
    });

    it('should return sample variables for order-confirmation type', () => {
      const data = service.getSampleData('order-confirmation');
      expect(data).toHaveProperty('order_number');
      expect(data).toHaveProperty('order_items');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('payment_method');
    });

    it('should return sample variables for status-change type', () => {
      const data = service.getSampleData('status-change');
      expect(data).toHaveProperty('status_label');
      expect(data).toHaveProperty('tracking_section');
    });

    it('should return sample variables for password-reset type', () => {
      const data = service.getSampleData('password-reset');
      expect(data).toHaveProperty('reset_url');
    });

    it('should return sample variables for review-reward type', () => {
      const data = service.getSampleData('review-reward');
      expect(data).toHaveProperty('coupon_code');
      expect(data).toHaveProperty('discount_percent');
    });

    it('should return sample variables for low-stock-alert type', () => {
      const data = service.getSampleData('low-stock-alert');
      expect(data).toHaveProperty('product_name');
      expect(data).toHaveProperty('current_stock');
      expect(data).toHaveProperty('stock_limit');
    });

    it('should return base variables for unknown type', () => {
      const data = service.getSampleData('unknown');
      expect(data).toHaveProperty('customer_name');
      expect(data).toHaveProperty('store_url');
    });
  });
});
