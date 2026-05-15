import { Test, TestingModule } from '@nestjs/testing';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CouponsService', () => {
  let service: CouponsService;
  let prisma: PrismaService;
  let settings: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: PrismaService,
          useValue: {
            coupon: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            couponUsage: {
              count: jest.fn().mockResolvedValue(0),
            },
            order: {
              count: jest.fn().mockResolvedValue(0),
            },
            affiliateAccount: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getReviewSettings: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    prisma = module.get<PrismaService>(PrismaService);
    settings = module.get<SettingsService>(SettingsService);
  });

  const now = new Date();

  function baseCoupon(overrides: Record<string, unknown> = {}) {
    return {
      id: 'coupon1',
      code: 'TEST10',
      type: 'PERCENTAGE',
      value: 10,
      minOrderValue: null,
      maxUses: null,
      usesPerUser: null,
      validFrom: null,
      validUntil: null,
      isFirstPurchaseOnly: false,
      isFreeShipping: false,
      isActive: true,
      categoryId: null,
      tagId: null,
      userId: null,
      stackable: false,
      stackableWith: [],
      _count: { usages: 0 },
      ...overrides,
    };
  }

  function mockCouponFound(overrides: Record<string, unknown> = {}) {
    (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(
      baseCoupon(overrides),
    );
  }

  describe('validate — PERCENTAGE', () => {
    it('applies 10% of subtotal', async () => {
      mockCouponFound();
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 200,
        userId: 'u1',
      });
      expect(r.discount).toBe(20);
      expect(r.type).toBe('PERCENTAGE');
    });

    it('rounds cents (15% of 100 = 15)', async () => {
      mockCouponFound({ value: 15 });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(15);
    });
  });

  describe('validate — FIXED', () => {
    it('applies a fixed value', async () => {
      mockCouponFound({ type: 'FIXED', value: 25 });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(25);
    });

    it('cap: fixed value cannot exceed subtotal', async () => {
      mockCouponFound({ type: 'FIXED', value: 200 });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 80,
        userId: 'u1',
      });
      expect(r.discount).toBe(80);
    });
  });

  describe('validate — FREE_SHIPPING', () => {
    it('returns discount=0 and FREE_SHIPPING type', async () => {
      mockCouponFound({ type: 'FREE_SHIPPING', value: 0 });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(0);
      expect(r.type).toBe('FREE_SHIPPING');
    });
  });

  describe('validate — isFreeShipping flag', () => {
    it('PERCENTAGE coupon with isFreeShipping returns discount + flag', async () => {
      mockCouponFound({ isFreeShipping: true });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
      expect(r.isFreeShipping).toBe(true);
    });

    it('FIXED coupon with isFreeShipping returns discount + flag', async () => {
      mockCouponFound({ type: 'FIXED', value: 15, isFreeShipping: true });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(15);
      expect(r.isFreeShipping).toBe(true);
    });

    it('coupon without isFreeShipping returns false flag', async () => {
      mockCouponFound({ isFreeShipping: false });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.isFreeShipping).toBe(false);
    });
  });

  describe('validate — isActive', () => {
    it('rejects inactive coupon', async () => {
      mockCouponFound({ isActive: false });
      await expect(
        service.validate({ code: 'TEST10', cartValue: 100 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validate — non-existent code', () => {
    it('rejects with NotFoundException', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.validate({ code: 'NONEXISTENT', cartValue: 100 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validate — time validity', () => {
    it('rejects coupon that has not started yet (validFrom in the future)', async () => {
      mockCouponFound({ validFrom: new Date(now.getTime() + 86400000) });
      await expect(
        service.validate({ code: 'TEST10', cartValue: 100, userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired coupon (validUntil in the past)', async () => {
      mockCouponFound({ validUntil: new Date(now.getTime() - 1000) });
      await expect(
        service.validate({ code: 'TEST10', cartValue: 100, userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts coupon within the period', async () => {
      mockCouponFound({
        validFrom: new Date(now.getTime() - 86400000),
        validUntil: new Date(now.getTime() + 86400000),
      });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });

    it('accepts coupon without dates (without temporal restriction)', async () => {
      mockCouponFound({ validFrom: null, validUntil: null });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });
  });

  describe('validate — minimum order value', () => {
    it('rejects if subtotal < minOrderValue', async () => {
      mockCouponFound({ minOrderValue: 100 });
      await expect(
        service.validate({ code: 'TEST10', cartValue: 80, userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts if subtotal = minOrderValue', async () => {
      mockCouponFound({ minOrderValue: 100 });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });

    it('accepts if subtotal > minOrderValue', async () => {
      mockCouponFound({ minOrderValue: 50 });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });

    it('accepts if minOrderValue is null (no minimum)', async () => {
      mockCouponFound({ minOrderValue: null });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 10,
        userId: 'u1',
      });
      expect(r.discount).toBe(1);
    });
  });

  describe('validate — total usage limit', () => {
    it('rejects when usages >= maxUses', async () => {
      mockCouponFound({ maxUses: 50, _count: { usages: 50 } });
      await expect(
        service.validate({ code: 'TEST10', cartValue: 100, userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts when usages < maxUses', async () => {
      mockCouponFound({ maxUses: 50, _count: { usages: 49 } });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });

    it('accepts if maxUses is null (unlimited)', async () => {
      mockCouponFound({ maxUses: null, _count: { usages: 9999 } });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });
  });

  describe('validate — per-user usage limit', () => {
    it('rejects when user has reached the limit', async () => {
      mockCouponFound({ usesPerUser: 1 });
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(1);
      await expect(
        service.validate({ code: 'TEST10', cartValue: 100, userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts when user still has available uses', async () => {
      mockCouponFound({ usesPerUser: 3 });
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(2);
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });

    it('accepts if usesPerUser is null (unlimited per user)', async () => {
      mockCouponFound({ usesPerUser: null });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });

    it('does not check usesPerUser if userId is not provided (guest checkout)', async () => {
      mockCouponFound({ usesPerUser: 1 });

      const r = await service.validate({ code: 'TEST10', cartValue: 100 });
      expect(r.discount).toBe(10);
    });
  });

  describe('validate — exclusive customer coupon', () => {
    it('rejects if coupon userId does not match user', async () => {
      mockCouponFound({ userId: 'vip-user' });
      await expect(
        service.validate({
          code: 'TEST10',
          cartValue: 100,
          userId: 'other-user',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts if userId matches', async () => {
      mockCouponFound({ userId: 'vip-user' });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'vip-user',
      });
      expect(r.discount).toBe(10);
    });

    it('accepts if coupon has no customer restriction (userId null)', async () => {
      mockCouponFound({ userId: null });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'any',
      });
      expect(r.discount).toBe(10);
    });
  });

  describe('validate — first purchase only', () => {
    it('rejects if customer already has confirmed/delivered orders', async () => {
      mockCouponFound({ isFirstPurchaseOnly: true });
      (prisma.order.count as jest.Mock).mockResolvedValue(2);
      await expect(
        service.validate({ code: 'TEST10', cartValue: 100, userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts if customer has 0 valid orders', async () => {
      mockCouponFound({ isFirstPurchaseOnly: true });
      (prisma.order.count as jest.Mock).mockResolvedValue(0);
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });

    it('checks order.count with filter excluding CANCELLED and trashed orders', async () => {
      mockCouponFound({ isFirstPurchaseOnly: true });
      (prisma.order.count as jest.Mock).mockResolvedValue(0);
      await service.validate({ code: 'TEST10', cartValue: 100, userId: 'u1' });

      expect(prisma.order.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'u1',
          deletedAt: null,
          status: { notIn: ['CANCELLED'] },
        }),
      });
    });

    it('does not check first purchase if userId is not provided', async () => {
      mockCouponFound({ isFirstPurchaseOnly: true });

      const r = await service.validate({ code: 'TEST10', cartValue: 100 });
      expect(r.discount).toBe(10);
      expect(prisma.order.count).not.toHaveBeenCalled();
    });
  });

  describe('validate — category restriction', () => {
    it('returns categoryId in the response for PricingService to validate', async () => {
      mockCouponFound({ categoryId: 'cat-figures' });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.categoryId).toBe('cat-figures');
    });

    it('returns null if no category restriction', async () => {
      mockCouponFound({ categoryId: null });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.categoryId).toBeNull();
    });
  });

  describe('validate — tag restriction', () => {
    it('returns tagId in the response for PricingService to validate', async () => {
      mockCouponFound({ tagId: 'tag-new-arrivals' });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.tagId).toBe('tag-new-arrivals');
    });

    it('returns null if no tag restriction', async () => {
      mockCouponFound({ tagId: null });
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.tagId).toBeNull();
    });
  });

  describe('validate — case insensitive', () => {
    it('searches code in uppercase independent of the input', async () => {
      mockCouponFound();
      await service.validate({ code: 'test10', cartValue: 100, userId: 'u1' });
      expect(prisma.coupon.findUnique).toHaveBeenCalledWith({
        where: { code: 'TEST10' },
        include: {
          _count: { select: { usages: true } },
          stackableWith: { select: { id: true } },
        },
      });
    });
  });

  describe('validate — combinations of conditions', () => {
    it('coupon with ALL active restrictions - accepts when everything matches', async () => {
      mockCouponFound({
        minOrderValue: 50,
        maxUses: 100,
        usesPerUser: 2,
        validFrom: new Date(now.getTime() - 86400000),
        validUntil: new Date(now.getTime() + 86400000),
        isFirstPurchaseOnly: false,
        userId: 'u1',
        categoryId: 'cat1',
        tagId: 'tag1',
        isFreeShipping: true,
        _count: { usages: 50 },
      });
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(1);

      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
      expect(r.categoryId).toBe('cat1');
      expect(r.tagId).toBe('tag1');
      expect(r.isFreeShipping).toBe(true);
    });

    it('coupon with ALL restrictions - rejects if ONE fails (minOrderValue)', async () => {
      mockCouponFound({
        minOrderValue: 200,
        maxUses: 100,
        usesPerUser: 2,
        validFrom: new Date(now.getTime() - 86400000),
        validUntil: new Date(now.getTime() + 86400000),
        userId: 'u1',
        _count: { usages: 50 },
      });
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.validate({ code: 'TEST10', cartValue: 100, userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('first purchase + exclusive customer - accepts correct new customer', async () => {
      mockCouponFound({ isFirstPurchaseOnly: true, userId: 'new-user' });
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'new-user',
      });
      expect(r.discount).toBe(10);
    });

    it('first purchase + exclusive customer - rejects wrong customer', async () => {
      mockCouponFound({ isFirstPurchaseOnly: true, userId: 'new-user' });
      await expect(
        service.validate({ code: 'TEST10', cartValue: 100, userId: 'other' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validate — stacking rules', () => {
    it('validates solo coupon (without appliedCouponIds) - legacy behavior', async () => {
      mockCouponFound();
      const r = await service.validate({
        code: 'TEST10',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.discount).toBe(10);
    });

    it('rejects when there are already 3 applied coupons (cap)', async () => {
      mockCouponFound({ stackable: true });
      (prisma.coupon.findMany as jest.Mock).mockResolvedValue([
        { id: 'a', code: 'A', stackable: true, stackableWith: [] },
        { id: 'b', code: 'B', stackable: true, stackableWith: [] },
        { id: 'c', code: 'C', stackable: true, stackableWith: [] },
      ]);
      await expect(
        service.validate({
          code: 'TEST10',
          cartValue: 100,
          userId: 'u1',
          appliedCouponIds: ['a', 'b', 'c'],
        }),
      ).rejects.toThrow(/maximum of 3/i);
    });

    it('rejects new non-stackable coupon when another already exists', async () => {
      mockCouponFound({ stackable: false, code: 'EXCLUSIVE' });
      (prisma.coupon.findMany as jest.Mock).mockResolvedValue([
        { id: 'a', code: 'WELCOME', stackable: true, stackableWith: [] },
      ]);
      await expect(
        service.validate({
          code: 'EXCLUSIVE',
          cartValue: 100,
          userId: 'u1',
          appliedCouponIds: ['a'],
        }),
      ).rejects.toThrow(/EXCLUSIVE.*cannot stack with.*WELCOME|EXCLUSIVE.*not in set/i);
    });

    it('rejects when existing applied coupon is not stackable', async () => {
      mockCouponFound({ stackable: true, code: 'NEW', id: 'new1' });
      (prisma.coupon.findMany as jest.Mock).mockResolvedValue([
        { id: 'old1', code: 'EXCLUSIVE', stackable: false, stackableWith: [] },
      ]);
      await expect(
        service.validate({
          code: 'NEW',
          cartValue: 100,
          userId: 'u1',
          appliedCouponIds: ['old1'],
        }),
      ).rejects.toThrow(/EXCLUSIVE/i);
    });

    it('accepts 2 stackable coupons without whitelist', async () => {
      mockCouponFound({ stackable: true, code: 'NEW', id: 'new1' });
      (prisma.coupon.findMany as jest.Mock).mockResolvedValue([
        { id: 'old1', code: 'OLD', stackable: true, stackableWith: [] },
      ]);
      const r = await service.validate({
        code: 'NEW',
        cartValue: 100,
        userId: 'u1',
        appliedCouponIds: ['old1'],
      });
      expect(r.couponId).toBe('new1');
    });

    it('rejects when new coupon whitelist does not include existing one', async () => {
      mockCouponFound({
        stackable: true,
        code: 'NEW',
        id: 'new1',
        stackableWith: [{ id: 'allowed1' }],
      });
      (prisma.coupon.findMany as jest.Mock).mockResolvedValue([
        { id: 'old1', code: 'OLD', stackable: true, stackableWith: [] },
      ]);
      await expect(
        service.validate({
          code: 'NEW',
          cartValue: 100,
          userId: 'u1',
          appliedCouponIds: ['old1'],
        }),
      ).rejects.toThrow(/NEW.*OLD|cannot stack/i);
    });

    it('rejects when existing applied coupon whitelist does not include new coupon (bidirectional check)', async () => {
      mockCouponFound({
        stackable: true,
        code: 'NEW',
        id: 'new1',
        stackableWith: [],
      });
      (prisma.coupon.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'old1',
          code: 'OLD',
          stackable: true,
          stackableWith: [{ id: 'someone-else' }],
        },
      ]);
      await expect(
        service.validate({
          code: 'NEW',
          cartValue: 100,
          userId: 'u1',
          appliedCouponIds: ['old1'],
        }),
      ).rejects.toThrow(/OLD.*NEW|cannot stack/i);
    });

    it('accepts when both whitelists include each other', async () => {
      mockCouponFound({
        stackable: true,
        code: 'NEW',
        id: 'new1',
        stackableWith: [{ id: 'old1' }],
      });
      (prisma.coupon.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'old1',
          code: 'OLD',
          stackable: true,
          stackableWith: [{ id: 'new1' }],
        },
      ]);
      const r = await service.validate({
        code: 'NEW',
        cartValue: 100,
        userId: 'u1',
        appliedCouponIds: ['old1'],
      });
      expect(r.couponId).toBe('new1');
    });

    it('returns stackable + stackableWithIds for caller to propagate', async () => {
      mockCouponFound({
        stackable: true,
        code: 'NEW',
        stackableWith: [{ id: 'x' }, { id: 'y' }],
      });
      const r = await service.validate({
        code: 'NEW',
        cartValue: 100,
        userId: 'u1',
      });
      expect(r.stackable).toBe(true);
      expect(r.stackableWithIds).toEqual(['x', 'y']);
    });
  });

  describe('create', () => {
    it('creates coupon with uppercase code', async () => {
      (prisma.coupon.create as jest.Mock).mockResolvedValue(
        baseCoupon({ code: 'SUMMER20' }),
      );

      await service.create({ code: 'summer20', type: 'PERCENTAGE', value: 20 });

      expect(prisma.coupon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ code: 'SUMMER20' }),
      });
    });

    it('creates coupon with isFreeShipping=true', async () => {
      (prisma.coupon.create as jest.Mock).mockResolvedValue(
        baseCoupon({ isFreeShipping: true }),
      );

      await service.create({
        code: 'SHIPPING',
        type: 'PERCENTAGE',
        value: 5,
        isFreeShipping: true,
      });

      expect(prisma.coupon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isFreeShipping: true }),
      });
    });

    it('creates coupon with all restrictions', async () => {
      (prisma.coupon.create as jest.Mock).mockResolvedValue(baseCoupon());

      await service.create({
        code: 'VIP',
        type: 'FIXED',
        value: 50,
        minOrderValue: 200,
        maxUses: 10,
        usesPerUser: 1,
        categoryId: 'cat1',
        tagId: 'tag1',
        userId: 'user1',
        isFirstPurchaseOnly: true,
        isFreeShipping: true,
      });

      expect(prisma.coupon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'VIP',
          type: 'FIXED',
          value: 50,
          minOrderValue: 200,
          maxUses: 10,
          usesPerUser: 1,
          categoryId: 'cat1',
          tagId: 'tag1',
          userId: 'user1',
          isFirstPurchaseOnly: true,
          isFreeShipping: true,
        }),
      });
    });
  });

  describe('createReviewReward', () => {
    const defaults = {
      enabled: true,
      firstEmailDays: 2,
      reminderDays: 2,
      couponType: 'PERCENTAGE' as const,
      couponValue: 10,
      couponValidityDays: 30,
      couponMinOrder: 0,
      maxPhotos: 5,
      maxPhotoSizeMb: 5,
      inviteValidityDays: 30,
    };

    it('generates PERCENTAGE coupon using settings values, user-exclusive', async () => {
      (settings.getReviewSettings as jest.Mock).mockResolvedValue(defaults);
      (prisma.coupon.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'coup1', ...data }),
      );

      const result = await service.createReviewReward('user1');

      expect(settings.getReviewSettings).toHaveBeenCalled();
      const call = (prisma.coupon.create as jest.Mock).mock.calls[0][0];

      expect(call.data.code).toMatch(/^REVIEW-[A-F0-9]{16}$/);
      expect(call.data.type).toBe('PERCENTAGE');
      expect(call.data.value).toBe(10);
      expect(call.data.userId).toBe('user1');
      expect(call.data.maxUses).toBe(1);
      expect(call.data.usesPerUser).toBe(1);
      expect(result.userId).toBe('user1');
    });

    it('respects couponType=FIXED and couponValue from settings', async () => {
      (settings.getReviewSettings as jest.Mock).mockResolvedValue({
        ...defaults,
        couponType: 'FIXED',
        couponValue: 25,
      });
      (prisma.coupon.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'coup1', ...data }),
      );

      await service.createReviewReward('user1');

      const call = (prisma.coupon.create as jest.Mock).mock.calls[0][0];
      expect(call.data.type).toBe('FIXED');
      expect(call.data.value).toBe(25);
    });

    it('defines validUntil = now + couponValidityDays', async () => {
      (settings.getReviewSettings as jest.Mock).mockResolvedValue({
        ...defaults,
        couponValidityDays: 15,
      });
      (prisma.coupon.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'coup1', ...data }),
      );

      const before = Date.now();
      await service.createReviewReward('user1');
      const call = (prisma.coupon.create as jest.Mock).mock.calls[0][0];
      const validUntil: Date = call.data.validUntil;
      const expected = before + 15 * 86400000;

      expect(validUntil.getTime()).toBeGreaterThanOrEqual(expected - 5000);
      expect(validUntil.getTime()).toBeLessThanOrEqual(expected + 5000);
    });

    it('sets minOrderValue when > 0', async () => {
      (settings.getReviewSettings as jest.Mock).mockResolvedValue({
        ...defaults,
        couponMinOrder: 150,
      });
      (prisma.coupon.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'coup1', ...data }),
      );

      await service.createReviewReward('user1');

      const call = (prisma.coupon.create as jest.Mock).mock.calls[0][0];
      expect(call.data.minOrderValue).toBe(150);
    });

    it('omits minOrderValue when 0 (no floor)', async () => {
      (settings.getReviewSettings as jest.Mock).mockResolvedValue(defaults);
      (prisma.coupon.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'coup1', ...data }),
      );

      await service.createReviewReward('user1');

      const call = (prisma.coupon.create as jest.Mock).mock.calls[0][0];
      expect(call.data.minOrderValue).toBeUndefined();
    });

    it('generates different codes in successive calls', async () => {
      (settings.getReviewSettings as jest.Mock).mockResolvedValue(defaults);
      (prisma.coupon.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'c', ...data }),
      );

      await service.createReviewReward('user1');
      await service.createReviewReward('user1');

      const codes = (prisma.coupon.create as jest.Mock).mock.calls.map(
        (c) => c[0].data.code,
      );
      expect(codes[0]).not.toBe(codes[1]);
    });
  });

  describe('create/update with affiliateId (attribution)', () => {
    const baseDto = {
      code: 'AFF10',
      type: 'PERCENTAGE' as const,
      value: 10,
    };

    it('create WITHOUT affiliateId does not look up affiliate (no-op validation)', async () => {
      (prisma.coupon.create as jest.Mock).mockResolvedValue({
        id: 'c1',
        ...baseDto,
      });

      await service.create(baseDto);

      expect(
        (prisma as any).affiliateAccount.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('create WITH valid affiliateId (status=APPROVED) → persists', async () => {
      (prisma as any).affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        status: 'APPROVED',
      });
      (prisma.coupon.create as jest.Mock).mockResolvedValue({
        id: 'c1',
        ...baseDto,
        affiliateId: 'aff-1',
      });

      const result = await service.create({
        ...baseDto,
        affiliateId: 'aff-1',
      });

      expect(result.affiliateId).toBe('aff-1');
      expect(prisma.coupon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ affiliateId: 'aff-1' }),
      });
    });

    it('create rejects when affiliateId points to non-existent account', async () => {
      (prisma as any).affiliateAccount.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, affiliateId: 'aff-nope' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.coupon.create).not.toHaveBeenCalled();
    });

    it('create rejects when affiliate not APPROVED (SUSPENDED/PENDING/REJECTED)', async () => {
      (prisma as any).affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-1',
        status: 'SUSPENDED',
      });

      await expect(
        service.create({ ...baseDto, affiliateId: 'aff-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.coupon.create).not.toHaveBeenCalled();
    });

    it('update with valid affiliateId validates before persisting', async () => {
      (prisma as any).affiliateAccount.findUnique.mockResolvedValue({
        id: 'aff-2',
        status: 'APPROVED',
      });
      (prisma.coupon.update as jest.Mock).mockResolvedValue({
        id: 'c1',
        affiliateId: 'aff-2',
      });

      await service.update('c1', { affiliateId: 'aff-2' });

      expect((prisma as any).affiliateAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'aff-2' } }),
      );
    });

    it('update with affiliateId=null does not validate (admin removing)', async () => {
      (prisma.coupon.update as jest.Mock).mockResolvedValue({ id: 'c1' });

      await service.update('c1', { affiliateId: null });

      expect(
        (prisma as any).affiliateAccount.findUnique,
      ).not.toHaveBeenCalled();
    });
  });
});
