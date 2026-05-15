import { Test, TestingModule } from '@nestjs/testing';
import { CartAbandonmentService } from './cart-abandonment.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CouponsService } from '../coupons/coupons.service';
import { EmailQueueService } from '../email/email-queue.service';
import { UnsubscribeService } from '../users/unsubscribe.service';
import { describe, beforeEach, it } from 'node:test';

describe('CartAbandonmentService', () => {
  let service: CartAbandonmentService;
  let prisma: any;
  let settings: any;
  let coupons: any;
  let emailQueue: any;

  const fullyConfiguredCfg = {
    firstEnabled: true,
    firstDelayHours: 24,
    secondEnabled: true,
    secondDelayHours: 48,
    couponType: 'PERCENTAGE' as const,
    couponValue: 10,
    couponValidityHours: 72,
    couponMinOrderValue: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartAbandonmentService,
        {
          provide: PrismaService,
          useValue: {
            cart: {
              findMany: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({}),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getAbandonmentSettings: jest
              .fn()
              .mockResolvedValue(fullyConfiguredCfg),
          },
        },
        {
          provide: CouponsService,
          useValue: {
            createAbandonmentReward: jest
              .fn()
              .mockResolvedValue({ id: 'cpn1', code: 'ABANDON-XYZ' }),
          },
        },
        {
          provide: EmailQueueService,
          useValue: {
            enqueueCartAbandonmentFirst: jest.fn().mockResolvedValue({}),
            enqueueCartAbandonmentSecond: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: UnsubscribeService,
          useValue: {
            generateToken: jest.fn().mockResolvedValue('jwt-unsub-token'),
            buildUrl: jest
              .fn()
              .mockResolvedValue(
                'https://redfigure.com/unsubscribe?t=jwt-unsub-token',
              ),
            buildOneClickUrl: jest
              .fn()
              .mockResolvedValue(
                'https://api.redfigure.com/api/v1/users/unsubscribe/one-click?t=jwt-unsub-token',
              ),
          },
        },
      ],
    }).compile();

    service = module.get(CartAbandonmentService);
    prisma = module.get(PrismaService);
    settings = module.get(SettingsService);
    coupons = module.get(CouponsService);
    emailQueue = module.get(EmailQueueService);
  });

  function cart(overrides: Partial<any> = {}) {
    return {
      id: 'cart1',
      userId: 'user1',
      items: [
        {
          productId: 'p1',
          name: 'Elf Miniature',
          quantity: 2,
          unitPrice: 49.9,
        },
      ],
      reminderSentAt: null,
      secondReminderSentAt: null,
      updatedAt: new Date('2026-05-05T10:00:00Z'),
      user: {
        id: 'user1',
        email: 'client@example.com',
        name: 'Maria Silva',
        emailMarketingOptOut: false,
      },
      ...overrides,
    };
  }

  describe('processAbandonedCarts — gate firstEnabled', () => {
    it('does not query carts for 1st email when firstEnabled=false', async () => {
      settings.getAbandonmentSettings.mockResolvedValueOnce({
        ...fullyConfiguredCfg,
        firstEnabled: false,
      });

      await service.processAbandonedCarts();

      const calls = prisma.cart.findMany.mock.calls;
      const firstReminderCall = calls.find(
        (c: any[]) => c[0]?.where?.reminderSentAt === null,
      );
      expect(firstReminderCall).toBeUndefined();
    });

    it('even with firstEnabled=false, processes 2nd email if secondEnabled=true (independent stages)', async () => {
      settings.getAbandonmentSettings.mockResolvedValueOnce({
        ...fullyConfiguredCfg,
        firstEnabled: false,
      });

      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.secondReminderSentAt === null) return [cart()];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result.firstSent).toBe(0);
      expect(result.secondSent).toBe(1);
    });
  });

  describe('processAbandonedCarts — gate secondEnabled e cupom', () => {
    it('does not query carts for 2nd email when secondEnabled=false', async () => {
      settings.getAbandonmentSettings.mockResolvedValueOnce({
        ...fullyConfiguredCfg,
        secondEnabled: false,
      });

      await service.processAbandonedCarts();

      const calls = prisma.cart.findMany.mock.calls;
      const secondReminderCall = calls.find(
        (c: any[]) => c[0]?.where?.secondReminderSentAt === null,
      );
      expect(secondReminderCall).toBeUndefined();
    });

    it('skips 2nd email when coupon is NOT configured (couponType=null) even with secondEnabled=true', async () => {
      settings.getAbandonmentSettings.mockResolvedValueOnce({
        ...fullyConfiguredCfg,
        couponType: null,
      });
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.secondReminderSentAt === null) return [cart()];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result.secondSent).toBe(0);
      expect(emailQueue.enqueueCartAbandonmentSecond).not.toHaveBeenCalled();
      expect(coupons.createAbandonmentReward).not.toHaveBeenCalled();
    });

    it('skips 2nd email when couponValue is absent', async () => {
      settings.getAbandonmentSettings.mockResolvedValueOnce({
        ...fullyConfiguredCfg,
        couponValue: null,
      });
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.secondReminderSentAt === null) return [cart()];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result.secondSent).toBe(0);
    });

    it('skips 2nd email when couponValidityHours is absent', async () => {
      settings.getAbandonmentSettings.mockResolvedValueOnce({
        ...fullyConfiguredCfg,
        couponValidityHours: null,
      });
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.secondReminderSentAt === null) return [cart()];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result.secondSent).toBe(0);
    });
  });

  describe('1o email — query e dispatch', () => {
    it('search carts with reminderSentAt=null and updatedAt < now-firstDelayHours', async () => {
      const now = new Date('2026-05-07T12:00:00Z');
      jest.useFakeTimers().setSystemTime(now.getTime());

      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null) return [];
        return [];
      });

      await service.processAbandonedCarts();

      const call = prisma.cart.findMany.mock.calls.find(
        (c: any[]) => c[0]?.where?.reminderSentAt === null,
      );
      expect(call).toBeDefined();

      const where = call[0].where;

      expect(where.updatedAt.lt).toEqual(new Date('2026-05-06T12:00:00Z'));

      jest.useRealTimers();
    });

    it('updateMany OCC BEFORE the enqueue (anti-false positive for active user)', async () => {
      const order: string[] = [];
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null) return [cart()];
        return [];
      });
      prisma.cart.updateMany.mockImplementation(async () => {
        order.push('updateMany');
        return { count: 1 };
      });
      emailQueue.enqueueCartAbandonmentFirst.mockImplementation(async () => {
        order.push('enqueue');
      });

      await service.processAbandonedCarts();

      expect(order).toEqual(['updateMany', 'enqueue']);
    });

    it('passes deterministic jobId + retention 25h (anti-dedup-leak)', async () => {
      const updated = new Date('2026-05-05T10:00:00Z');
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null)
          return [cart({ id: 'cart-x', updatedAt: updated })];
        return [];
      });

      await service.processAbandonedCarts();

      expect(emailQueue.enqueueCartAbandonmentFirst).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          jobId: `abandon-1-cart-x-${updated.getTime()}`,
          removeOnComplete: { age: 90_000 },
          removeOnFail: { age: 90_000 },
        }),
      );
    });

    it('OCC: updateMany uses updatedAt match to avoid overwriting user reset', async () => {
      const updated = new Date('2026-05-05T10:00:00Z');
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null)
          return [cart({ id: 'cart-occ', updatedAt: updated })];
        return [];
      });

      await service.processAbandonedCarts();

      expect(prisma.cart.updateMany).toHaveBeenCalledWith({
        where: { id: 'cart-occ', updatedAt: updated },
        data: { reminderSentAt: expect.any(Date) },
      });
    });

    it('OCC count=0 (race) blocks sending — email does NOT go to queue', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null) return [cart()];
        return [];
      });
      prisma.cart.updateMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.processAbandonedCarts();
      expect(result.firstSent).toBe(0);
      expect(result.skipped).toBe(1);
      expect(emailQueue.enqueueCartAbandonmentFirst).not.toHaveBeenCalled();
    });

    it('DB rollback if enqueue fails (next cron tries again)', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null) return [cart()];
        return [];
      });

      prisma.cart.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });
      emailQueue.enqueueCartAbandonmentFirst.mockRejectedValueOnce(
        new Error('redis down'),
      );

      const result = await service.processAbandonedCarts();
      expect(result.firstSent).toBe(0);
      expect(result.skipped).toBe(1);

      const rollbackCall = prisma.cart.updateMany.mock.calls[1];
      expect(rollbackCall[0]).toEqual(
        expect.objectContaining({
          data: { reminderSentAt: null },
        }),
      );
    });

    it('skips cart with empty items AND marks BOTH sentAt via OCC (anti-zombie + race-safe)', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null)
          return [cart({ id: 'zombie', items: [] })];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result.firstSent).toBe(0);
      expect(emailQueue.enqueueCartAbandonmentFirst).not.toHaveBeenCalled();
      expect(prisma.cart.updateMany).toHaveBeenCalledWith({
        where: { id: 'zombie', updatedAt: expect.any(Date) },
        data: expect.objectContaining({
          reminderSentAt: expect.any(Date),
          secondReminderSentAt: expect.any(Date),
        }),
      });
    });

    it('passes take=500 in findMany (anti-OOM)', async () => {
      prisma.cart.findMany.mockResolvedValue([]);
      await service.processAbandonedCarts();
      const firstCall = prisma.cart.findMany.mock.calls.find(
        (c: any[]) => c[0]?.where?.reminderSentAt === null,
      );
      expect(firstCall[0].take).toBe(500);
    });

    it('query filters users with emailMarketingOptOut=false (LGPD/CAN-SPAM)', async () => {
      prisma.cart.findMany.mockResolvedValue([]);
      await service.processAbandonedCarts();
      const firstCall = prisma.cart.findMany.mock.calls.find(
        (c: any[]) => c[0]?.where?.reminderSentAt === null,
      );
      expect(firstCall[0].where.user).toEqual({ emailMarketingOptOut: false });
    });

    it('1st email payload contains unsubscribeUrl generated via UnsubscribeService', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null) return [cart()];
        return [];
      });

      await service.processAbandonedCarts();

      expect(emailQueue.enqueueCartAbandonmentFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          unsubscribeUrl: expect.stringContaining(
            '/unsubscribe?t=jwt-unsub-token',
          ),
        }),
        expect.any(Object),
      );
    });

    it('skips cart without userId (defense in depth — query already filters)', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null)
          return [cart({ userId: null, user: null })];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result.firstSent).toBe(0);
    });

    it('skips cart without email in User (defense)', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null)
          return [cart({ user: { id: 'user1', email: null, name: 'X' } })];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result.firstSent).toBe(0);
    });

    it('calls enqueueCartAbandonmentFirst com payload {to,customerName,items,total,cartUrl,storeName}', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null) return [cart()];
        return [];
      });

      await service.processAbandonedCarts();

      expect(emailQueue.enqueueCartAbandonmentFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          customerName: 'Maria Silva',
          items: expect.any(Array),
          total: expect.any(Number),
          cartUrl: expect.any(String),
        }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );
    });
  });

  describe('2nd email — query, coupon and dispatch', () => {
    it('search carts with secondReminderSentAt=null and reminderSentAt < now-secondDelayHours', async () => {
      const now = new Date('2026-05-07T12:00:00Z');
      jest.useFakeTimers().setSystemTime(now.getTime());

      prisma.cart.findMany.mockResolvedValue([]);

      await service.processAbandonedCarts();

      const call = prisma.cart.findMany.mock.calls.find(
        (c: any[]) => c[0]?.where?.secondReminderSentAt === null,
      );
      expect(call).toBeDefined();

      const where = call[0].where;

      expect(where.reminderSentAt.lt).toEqual(new Date('2026-05-05T12:00:00Z'));
      expect(where.reminderSentAt.not).toBeNull();

      jest.useRealTimers();
    });

    it('creates coupon with userId from cart, type/value/validity from settings', async () => {
      const now = new Date('2026-05-07T12:00:00Z');
      jest.useFakeTimers().setSystemTime(now.getTime());
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.secondReminderSentAt === null) return [cart()];
        return [];
      });

      await service.processAbandonedCarts();

      expect(coupons.createAbandonmentReward).toHaveBeenCalledWith({
        userId: 'user1',
        type: 'PERCENTAGE',
        value: 10,
        validUntil: new Date('2026-05-10T12:00:00Z'),
        minOrderValue: 0,
      });
      jest.useRealTimers();
    });

    it('updateMany OCC before enqueue also in 2nd stage', async () => {
      const order: string[] = [];
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.secondReminderSentAt === null) return [cart()];
        return [];
      });
      prisma.cart.updateMany.mockImplementation(async () => {
        order.push('updateMany');
        return { count: 1 };
      });
      emailQueue.enqueueCartAbandonmentSecond.mockImplementation(async () => {
        order.push('enqueue');
      });

      await service.processAbandonedCarts();

      expect(order).toEqual(['updateMany', 'enqueue']);
    });

    it('2nd email payload contains couponCode, couponLabel and couponValidUntil', async () => {
      const now = new Date('2026-05-07T12:00:00Z');
      jest.useFakeTimers().setSystemTime(now.getTime());
      coupons.createAbandonmentReward.mockResolvedValueOnce({
        id: 'cpn1',
        code: 'ABANDON-USR1-AB12CD',
      });
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.secondReminderSentAt === null) return [cart()];
        return [];
      });

      await service.processAbandonedCarts();

      expect(emailQueue.enqueueCartAbandonmentSecond).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          couponCode: 'ABANDON-USR1-AB12CD',
          couponLabel: '10%',
          couponValidUntil: new Date('2026-05-10T12:00:00Z'),
        }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );
      jest.useRealTimers();
    });

    it('couponLabel formats FIXED as "XX.XXXVNĐ"', async () => {
      settings.getAbandonmentSettings.mockResolvedValueOnce({
        ...fullyConfiguredCfg,
        couponType: 'FIXED' as const,
        couponValue: 20000,
      });
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.secondReminderSentAt === null) return [cart()];
        return [];
      });

      await service.processAbandonedCarts();

      expect(emailQueue.enqueueCartAbandonmentSecond).toHaveBeenCalledWith(
        expect.objectContaining({ couponLabel: '20.000VNĐ' }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );
    });

    it('skips cart with empty items in 2nd email', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.secondReminderSentAt === null)
          return [cart({ items: [] })];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result.secondSent).toBe(0);
      expect(coupons.createAbandonmentReward).not.toHaveBeenCalled();
    });
  });

  describe('return', () => {
    it('returns { firstSent, secondSent, skipped } with correct counts', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null)
          return [cart({ id: 'a' }), cart({ id: 'b' })];
        if (args?.where?.secondReminderSentAt === null)
          return [cart({ id: 'c' })];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result).toEqual({ firstSent: 2, secondSent: 1, skipped: 0 });
    });

    it('counts skipped when cart is ignored because of empty items', async () => {
      prisma.cart.findMany.mockImplementation((args: any) => {
        if (args?.where?.reminderSentAt === null)
          return [cart({ id: 'a', items: [] })];
        return [];
      });

      const result = await service.processAbandonedCarts();
      expect(result.skipped).toBe(1);
      expect(result.firstSent).toBe(0);
    });
  });
});
