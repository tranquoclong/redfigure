import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HolidaysService', () => {
  let service: HolidaysService;
  let prisma: {
    holiday: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      holiday: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HolidaysService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<HolidaysService>(HolidaysService);
  });

  describe('create', () => {
    it('should create a holiday successfully', async () => {
      const dto = { date: '2026-12-25', name: 'Christmas' };
      const created = {
        id: 'h1',
        date: new Date('2026-12-25'),
        name: 'Christmas',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.holiday.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(prisma.holiday.create).toHaveBeenCalledWith({
        data: { date: new Date('2026-12-25'), name: 'Christmas' },
      });
    });

    it('should throw ConflictException when date already exists', async () => {
      const dto = { date: '2026-12-25', name: 'Christmas' };
      prisma.holiday.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return holidays ordered by date ascending', async () => {
      const holidays = [
        { id: 'h1', date: new Date('2026-04-21'), name: 'Tiradentes' },
        { id: 'h2', date: new Date('2026-09-07'), name: 'Independence' },
        { id: 'h3', date: new Date('2026-12-25'), name: 'Christmas' },
      ];
      prisma.holiday.findMany.mockResolvedValue(holidays);

      const result = await service.findAll();

      expect(result).toEqual(holidays);
      expect(prisma.holiday.findMany).toHaveBeenCalledWith({
        orderBy: { date: 'asc' },
      });
    });
  });

  describe('remove', () => {
    it('should delete a holiday by id', async () => {
      prisma.holiday.findUnique.mockResolvedValue({ id: 'h1' });
      prisma.holiday.delete.mockResolvedValue({ id: 'h1' });

      await service.remove('h1');

      expect(prisma.holiday.delete).toHaveBeenCalledWith({
        where: { id: 'h1' },
      });
    });

    it('should throw NotFoundException if holiday not found', async () => {
      prisma.holiday.findUnique.mockResolvedValue(null);

      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHolidayDates', () => {
    it('should return a Set of ISO date strings', async () => {
      prisma.holiday.findMany.mockResolvedValue([
        { date: new Date('2026-04-21') },
        { date: new Date('2026-12-25') },
      ]);

      const result = await service.getHolidayDates();

      expect(result).toBeInstanceOf(Set);
      expect(result.has('2026-04-21')).toBe(true);
      expect(result.has('2026-12-25')).toBe(true);
      expect(result.size).toBe(2);
    });
  });
});
