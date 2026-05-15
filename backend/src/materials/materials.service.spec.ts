import { Test, TestingModule } from '@nestjs/testing';
import { MaterialsService } from './materials.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('MaterialsService', () => {
  let service: MaterialsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      material: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MaterialsService>(MaterialsService);
  });

  describe('create', () => {
    it('creates a material with auto slug', async () => {
      prisma.material.findUnique.mockResolvedValue(null);
      prisma.material.create.mockResolvedValue({
        id: 'm1',
        name: 'Resin',
        slug: 'resin',
      });

      const result = await service.create({ name: 'Resin' });

      expect(result.slug).toBe('resin');
      expect(prisma.material.create).toHaveBeenCalledWith({
        data: { name: 'Resin', slug: 'resin' },
      });
    });

    it('throws ConflictException for duplicate slug', async () => {
      prisma.material.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create({ name: 'Resin' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('returns active materials ordered by name', async () => {
      prisma.material.findMany.mockResolvedValue([
        { id: 'm1', name: 'PLA' },
        { id: 'm2', name: 'Resin' },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(prisma.material.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('returns the material when found', async () => {
      prisma.material.findUnique.mockResolvedValue({
        id: 'm1',
        name: 'Resin',
      });
      const result = await service.findById('m1');
      expect(result.id).toBe('m1');
    });

    it('throws NotFoundException when missing', async () => {
      prisma.material.findUnique.mockResolvedValue(null);
      await expect(service.findById('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('regenerates slug when name changes', async () => {
      prisma.material.update.mockResolvedValue({});
      await service.update('m1', { name: 'Resin UV' });
      expect(prisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { name: 'Resin UV', slug: 'resin-uv' },
      });
    });
  });

  describe('remove', () => {
    it('soft-deletes', async () => {
      prisma.material.update.mockResolvedValue({});
      await service.remove('m1');
      expect(prisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { isActive: false },
      });
    });
  });
});
