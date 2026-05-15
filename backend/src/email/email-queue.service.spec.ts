import { Test, TestingModule } from '@nestjs/testing';
import { EmailQueueService } from './email-queue.service';
import { EmailService } from './email.service';

jest.mock('bullmq', () => {
  const mockAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: mockAdd,
      close: jest.fn(),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn(),
    })),
  };
});

describe('EmailQueueService', () => {
  let service: EmailQueueService;
  let emailService: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailQueueService,
        {
          provide: EmailService,
          useValue: {
            sendWelcome: jest.fn().mockResolvedValue({ messageId: 'msg1' }),
            sendPaymentApproved: jest
              .fn()
              .mockResolvedValue({ messageId: 'pay1' }),
            sendOrderInProduction: jest
              .fn()
              .mockResolvedValue({ messageId: 'prod1' }),
            sendOrderShipped: jest
              .fn()
              .mockResolvedValue({ messageId: 'ship1' }),
            sendOrderDelivered: jest
              .fn()
              .mockResolvedValue({ messageId: 'deli1' }),
            sendOrderCancelled: jest
              .fn()
              .mockResolvedValue({ messageId: 'canc1' }),
            sendOrderRefunded: jest
              .fn()
              .mockResolvedValue({ messageId: 'ref1' }),
            sendPasswordReset: jest
              .fn()
              .mockResolvedValue({ messageId: 'msg4' }),
            sendReviewReward: jest
              .fn()
              .mockResolvedValue({ messageId: 'msg5' }),
            sendLowStockAlert: jest
              .fn()
              .mockResolvedValue({ messageId: 'msg6' }),
          },
        },
        {
          provide: 'REDIS_CONNECTION',
          useValue: { host: 'localhost', port: 6379 },
        },
      ],
    }).compile();

    service = module.get<EmailQueueService>(EmailQueueService);
    emailService = module.get<EmailService>(EmailService);
  });

  describe('enqueueWelcome', () => {
    it('should add welcome job to queue', async () => {
      const result = await service.enqueueWelcome({
        to: 'user@example.com',
        name: 'John',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('job-1');
    });
  });

  describe('enqueuePaymentApproved', () => {
    it('should add payment-approved job with payment method label', async () => {
      const result = await service.enqueuePaymentApproved({
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-789',
        orderId: 'order3',
        items: [{ name: 'Miniature', quantity: 1, price: 100 }],
        total: 110,
        paymentMethod: 'sepay',
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueueOrderInProduction', () => {
    it('should add order-in-production job to queue', async () => {
      const result = await service.enqueueOrderInProduction({
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueueOrderShipped', () => {
    it('should add order-shipped job with tracking info', async () => {
      const result = await service.enqueueOrderShipped({
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
        trackingCode: 'VN123456789',
        trackingUrl: 'https://rastreio.ex/VN123',
        carrier: 'Correios',
        deliveryDays: 7,
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueueOrderDelivered', () => {
    it('should add order-delivered job to queue', async () => {
      const result = await service.enqueueOrderDelivered({
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueueOrderCancelled', () => {
    it('should add order-cancelled job with optional reason', async () => {
      const result = await service.enqueueOrderCancelled({
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
        reason: 'Cancelled at customer request',
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueueOrderRefunded', () => {
    it('should add order-refunded job with optional reason', async () => {
      const result = await service.enqueueOrderRefunded({
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
        reason: 'Product returned',
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueuePasswordReset', () => {
    it('should add password reset job to queue', async () => {
      const result = await service.enqueuePasswordReset({
        to: 'user@example.com',
        name: 'Carlos',
        resetUrl: 'https://redfigure.com/reset?token=abc',
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueueReviewReward', () => {
    it('should add review reward job to queue', async () => {
      const result = await service.enqueueReviewReward({
        to: 'user@example.com',
        customerName: 'Maria',
        productName: 'Dragon',
        couponCode: 'REVIEW-XYZ',
        discountPercent: 5,
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueueLowStockAlert', () => {
    it('should add low stock alert job to queue', async () => {
      const result = await service.enqueueLowStockAlert({
        to: 'admin@example.com',
        productName: 'Dragon',
        currentStock: 2,
        threshold: 5,
      });

      expect(result).toBeDefined();
    });
  });

  describe('processJob', () => {
    it('should call sendWelcome for welcome type', async () => {
      await service.processJob({
        type: 'welcome',
        payload: { to: 'user@example.com', name: 'John Doe' },
      });

      expect(emailService.sendWelcome).toHaveBeenCalledWith({
        to: 'user@example.com',
        name: 'John Doe',
      });
    });

    it('should call sendPaymentApproved for payment-approved type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-789',
        orderId: 'order3',
        items: [],
        total: 110,
        paymentMethod: 'sepay',
      };

      await service.processJob({ type: 'payment-approved', payload });

      expect(emailService.sendPaymentApproved).toHaveBeenCalledWith(payload);
    });

    it('should call sendOrderInProduction for order-in-production type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
      };
      await service.processJob({ type: 'order-in-production', payload });
      expect(emailService.sendOrderInProduction).toHaveBeenCalledWith(payload);
    });

    it('should call sendOrderShipped for order-shipped type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
        trackingCode: 'VN123',
      };
      await service.processJob({ type: 'order-shipped', payload });
      expect(emailService.sendOrderShipped).toHaveBeenCalledWith(payload);
    });

    it('should call sendOrderDelivered for order-delivered type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
      };
      await service.processJob({ type: 'order-delivered', payload });
      expect(emailService.sendOrderDelivered).toHaveBeenCalledWith(payload);
    });

    it('should call sendOrderCancelled for order-cancelled type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
      };
      await service.processJob({ type: 'order-cancelled', payload });
      expect(emailService.sendOrderCancelled).toHaveBeenCalledWith(payload);
    });

    it('should call sendOrderRefunded for order-refunded type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        orderId: 'order1',
      };
      await service.processJob({ type: 'order-refunded', payload });
      expect(emailService.sendOrderRefunded).toHaveBeenCalledWith(payload);
    });

    it('should call sendPasswordReset for password-reset type', async () => {
      const payload = {
        to: 'user@example.com',
        name: 'Carlos',
        resetUrl: 'https://example.com/reset',
      };

      await service.processJob({ type: 'password-reset', payload });

      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(payload);
    });

    it('should call sendReviewReward for review-reward type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Maria',
        productName: 'Dragon',
        couponCode: 'ABC',
        discountPercent: 5,
      };

      await service.processJob({ type: 'review-reward', payload });

      expect(emailService.sendReviewReward).toHaveBeenCalledWith(payload);
    });

    it('should call sendLowStockAlert for low-stock-alert type', async () => {
      const payload = {
        to: 'admin@example.com',
        productName: 'Dragon',
        currentStock: 2,
        threshold: 5,
      };

      await service.processJob({ type: 'low-stock-alert', payload });

      expect(emailService.sendLowStockAlert).toHaveBeenCalledWith(payload);
    });

    it('should throw for unknown email type', async () => {
      await expect(
        service.processJob({ type: 'unknown' as any, payload: {} }),
      ).rejects.toThrow('Unknown email type: unknown');
    });
  });
});
