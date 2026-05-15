import { Test, TestingModule } from '@nestjs/testing';
import { BrandsService } from './brands.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('BrandsService', () => {
  let service: BrandsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        {
          provide: PrismaService,
          useValue: {
            brand: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<BrandsService>(BrandsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create brand with auto-slug', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.brand.create as jest.Mock).mockResolvedValue({
        id: 'b1',
        name: 'Arsenal Craft',
        slug: 'arsenal-craft',
      });

      const result = await service.create({ name: 'Arsenal Craft' });

      expect(result.slug).toBe('arsenal-craft');
    });

    it('should throw ConflictException for duplicate name', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
      });

      await expect(service.create({ name: 'Arsenal Craft' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('create with skuPrefix', () => {
    it('should create brand with skuPrefix and renameFolderDefault', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.brand.create as jest.Mock).mockResolvedValue({
        id: 'b1',
        name: 'Cyber Nerd',
        slug: 'cyber-nerd',
        skuPrefix: 'CNP',
        renameFolderDefault: true,
      });

      const result = await service.create({
        name: 'Cyber Nerd',
        skuPrefix: 'CNP',
        renameFolderDefault: true,
      });

      expect(prisma.brand.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          skuPrefix: 'CNP',
          renameFolderDefault: true,
        }),
      });
      expect(result.skuPrefix).toBe('CNP');
    });

    it('should set skuPrefix to null when empty string', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.brand.create as jest.Mock).mockResolvedValue({
        id: 'b1',
        name: 'NoBrand',
        slug: 'nobrand',
        skuPrefix: null,
      });

      await service.create({ name: 'NoBrand', skuPrefix: '' });

      expect(prisma.brand.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ skuPrefix: null }),
      });
    });
  });

  describe('update with skuPrefix', () => {
    it('should update skuPrefix', async () => {
      (prisma.brand.update as jest.Mock).mockResolvedValue({
        id: 'b1',
        skuPrefix: 'NEW',
      });

      await service.update('b1', { skuPrefix: 'NEW' });

      expect(prisma.brand.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: expect.objectContaining({ skuPrefix: 'NEW' }),
      });
    });

    it('should set skuPrefix to null when empty string', async () => {
      (prisma.brand.update as jest.Mock).mockResolvedValue({
        id: 'b1',
        skuPrefix: null,
      });

      await service.update('b1', { skuPrefix: '' });

      expect(prisma.brand.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: expect.objectContaining({ skuPrefix: null }),
      });
    });
  });

  describe('scaleRuleSetId / noScales', () => {
    it('should create brand with scaleRuleSetId and noScales', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.brand.create as jest.Mock).mockResolvedValue({
        id: 'b1',
        name: 'X',
        slug: 'x',
        scaleRuleSetId: 'rs1',
        noScales: false,
      });

      await service.create({
        name: 'X',
        scaleRuleSetId: 'rs1',
        noScales: false,
      });

      expect(prisma.brand.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scaleRuleSetId: 'rs1',
          noScales: false,
        }),
      });
    });

    it('update with scaleRuleSetId should use scaleRuleSet.connect (avoid Prisma checked-mode error)', async () => {
      (prisma.brand.update as jest.Mock).mockResolvedValue({ id: 'b1' });

      await service.update('b1', { scaleRuleSetId: 'rs1' });

      const callArgs = (prisma.brand.update as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.scaleRuleSet).toEqual({ connect: { id: 'rs1' } });
      expect(callArgs.data.scaleRuleSetId).toBeUndefined();
    });

    it('update with empty scaleRuleSetId should disconnect', async () => {
      (prisma.brand.update as jest.Mock).mockResolvedValue({ id: 'b1' });

      await service.update('b1', { scaleRuleSetId: '' });

      const callArgs = (prisma.brand.update as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.scaleRuleSet).toEqual({ disconnect: true });
    });

    it('update with noScales=true', async () => {
      (prisma.brand.update as jest.Mock).mockResolvedValue({ id: 'b1' });

      await service.update('b1', { noScales: true });

      expect(prisma.brand.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: expect.objectContaining({ noScales: true }),
      });
    });
  });

  describe('findBySlug', () => {
    it('should return brand by slug', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue({
        id: 'b1',
        name: 'Arsenal Craft',
        slug: 'arsenal-craft',
      });

      const result = await service.findBySlug('arsenal-craft');

      expect(result.slug).toBe('arsenal-craft');
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
