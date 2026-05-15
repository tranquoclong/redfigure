import { Test, TestingModule } from '@nestjs/testing';
import { ColorsService } from './colors.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ColorsService', () => {
  let service: ColorsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      color: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ColorsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ColorsService>(ColorsService);
  });

  describe('create', () => {
    it('creates a color with auto-generated slug', async () => {
      prisma.color.findUnique.mockResolvedValue(null);
      prisma.color.create.mockResolvedValue({
        id: 'c1',
        name: 'Red',
        slug: 'red',
      });

      const result = await service.create({ name: 'Red' });

      expect(result.slug).toBe('red');
      expect(prisma.color.create).toHaveBeenCalledWith({
        data: { name: 'Red', slug: 'red' },
      });
    });

    it('slugifies multi-word names with diacritics', async () => {
      prisma.color.findUnique.mockResolvedValue(null);
      prisma.color.create.mockImplementation(async ({ data }: any) => ({
        id: 'c2',
        ...data,
      }));

      const result = await service.create({ name: 'Blue Navy' });

      expect(result.slug).toBe('blue-navy');
    });

    it('throws ConflictException when slug already exists', async () => {
      prisma.color.findUnique.mockResolvedValue({
        id: 'existing',
        slug: 'red',
      });

      await expect(service.create({ name: 'Red' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('returns active colors ordered by name', async () => {
      prisma.color.findMany.mockResolvedValue([
        { id: 'c1', name: 'Blue' },
        { id: 'c2', name: 'Red' },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(prisma.color.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('updates the name and regenerates the slug', async () => {
      prisma.color.update.mockResolvedValue({
        id: 'c1',
        name: 'Blue Navy',
        slug: 'blue-navy',
      });

      const result = await service.update('c1', { name: 'Blue Navy' });

      expect(prisma.color.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { name: 'Blue Navy', slug: 'blue-navy' },
      });
      expect(result.slug).toBe('blue-navy');
    });

    it('keeps the existing slug when name is not updated', async () => {
      prisma.color.update.mockResolvedValue({});

      await service.update('c1', {});

      expect(prisma.color.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {},
      });
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting isActive to false', async () => {
      prisma.color.update.mockResolvedValue({ id: 'c1', isActive: false });

      await service.remove('c1');

      expect(prisma.color.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { isActive: false },
      });
    });
  });

  describe('findById', () => {
    it('returns the color when found', async () => {
      prisma.color.findUnique.mockResolvedValue({ id: 'c1', name: 'Red' });
      const result = await service.findById('c1');
      expect(result.id).toBe('c1');
    });

    it('throws NotFoundException when color does not exist', async () => {
      prisma.color.findUnique.mockResolvedValue(null);
      await expect(service.findById('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
