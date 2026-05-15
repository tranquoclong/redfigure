import { Test, TestingModule } from '@nestjs/testing';
import { BannersService } from './banners.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException } from '@nestjs/common';

describe('BannersService', () => {
  let service: BannersService;
  let prisma: PrismaService;

  const REAL_NOW = Date.now;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BannersService,
        {
          provide: PrismaService,
          useValue: {
            banner: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: { del: jest.fn().mockResolvedValue(1) },
        },
      ],
    }).compile();

    service = module.get(BannersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    Date.now = REAL_NOW;
  });

  describe('findActive', () => {
    it('returns active banners ordered by order asc, with date window filtering', async () => {
      (prisma.banner.findMany as jest.Mock).mockResolvedValue([
        { id: 'b1', title: 'A', order: 0 },
      ]);

      const before = new Date();
      await service.findActive();
      const after = new Date();

      const callArgs = (prisma.banner.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.isActive).toBe(true);
      expect(callArgs.orderBy).toEqual([
        { order: 'asc' },
        { createdAt: 'desc' },
      ]);

      const startDateLte = callArgs.where.AND[0].OR[1].startDate.lte as Date;
      const endDateGte = callArgs.where.AND[1].OR[1].endDate.gte as Date;
      expect(startDateLte.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(startDateLte.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(endDateGte.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(endDateGte.getTime()).toBeLessThanOrEqual(after.getTime());

      expect(callArgs.where.AND[0].OR[0]).toEqual({ startDate: null });
      expect(callArgs.where.AND[1].OR[0]).toEqual({ endDate: null });
    });
  });

  describe('findAll (admin)', () => {
    it('returns all banners (active or not, any date) ordered by order asc', async () => {
      (prisma.banner.findMany as jest.Mock).mockResolvedValue([]);
      await service.findAll();
      expect(prisma.banner.findMany).toHaveBeenCalledWith({
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('create', () => {
    it('creates a banner with all provided fields', async () => {
      const dto = {
        title: 'Aurora',
        eyebrow: '★ NEW',
        order: 1,
        isActive: true,
      };
      (prisma.banner.create as jest.Mock).mockResolvedValue({
        id: 'b1',
        ...dto,
      });
      const result = await service.create(dto);
      expect(prisma.banner.create).toHaveBeenCalledWith({ data: dto });
      expect(result.id).toBe('b1');
    });
  });

  describe('update', () => {
    it('updates an existing banner', async () => {
      (prisma.banner.findUnique as jest.Mock).mockResolvedValue({ id: 'b1' });
      (prisma.banner.update as jest.Mock).mockResolvedValue({
        id: 'b1',
        title: 'Aurora 2',
      });
      await service.update('b1', { title: 'Aurora 2' });
      expect(prisma.banner.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { title: 'Aurora 2' },
      });
    });

    it('throws NotFoundException when banner does not exist', async () => {
      (prisma.banner.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.update('nope', { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.banner.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the banner', async () => {
      (prisma.banner.findUnique as jest.Mock).mockResolvedValue({ id: 'b1' });
      (prisma.banner.delete as jest.Mock).mockResolvedValue({});
      await service.remove('b1');
      expect(prisma.banner.delete).toHaveBeenCalledWith({
        where: { id: 'b1' },
      });
    });

    it('throws NotFoundException when banner does not exist', async () => {
      (prisma.banner.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('updates the order field for each banner in the array', async () => {
      (prisma.banner.update as jest.Mock).mockResolvedValue({});
      await service.reorder([
        { id: 'b1', order: 0 },
        { id: 'b2', order: 1 },
      ]);
      expect(prisma.banner.update).toHaveBeenCalledTimes(2);
      expect(prisma.banner.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { order: 0 },
      });
      expect(prisma.banner.update).toHaveBeenCalledWith({
        where: { id: 'b2' },
        data: { order: 1 },
      });
    });
  });
});
