import { Test, TestingModule } from '@nestjs/testing';
import { AttributesService } from './attributes.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('AttributesService', () => {
  let service: AttributesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributesService,
        {
          provide: PrismaService,
          useValue: {
            attribute: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            attributeValue: {
              create: jest.fn(),
              delete: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AttributesService>(AttributesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create attribute with auto-slug', async () => {
      (prisma.attribute.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.attribute.create as jest.Mock).mockResolvedValue({
        id: 'attr1',
        name: 'Arm',
        slug: 'arm',
      });

      const result = await service.create({ name: 'Arm' });

      expect(result.slug).toBe('arm');
    });

    it('should throw ConflictException for duplicate non-deleted name', async () => {
      (prisma.attribute.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
        slug: 'arm',
        deletedAt: null,
      });

      await expect(service.create({ name: 'Arm' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow reuse of slug whose previous owner was soft-deleted', async () => {
      (prisma.attribute.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.attribute.create as jest.Mock).mockResolvedValue({
        id: 'attr-new',
        name: 'Arm',
        slug: 'arm',
      });

      const result = await service.create({ name: 'Arm' });

      expect(result.slug).toBe('arm');
    });
  });

  describe('findAll', () => {
    it('should filter out soft-deleted attributes and their values', async () => {
      (prisma.attribute.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'attr1',
          name: 'Arm',
          slug: 'arm',
          deletedAt: null,
          values: [
            { id: 'v1', value: 'Fantasy', slug: 'fantasy', deletedAt: null },
          ],
        },
      ]);

      await service.findAll();

      const call = (prisma.attribute.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual({ deletedAt: null });
      expect(call.include.values.where).toEqual({ deletedAt: null });
    });
  });

  describe('findBySlug', () => {
    it('should treat soft-deleted attribute as not found', async () => {
      (prisma.attribute.findUnique as jest.Mock).mockResolvedValue({
        id: 'attr1',
        slug: 'arm',
        deletedAt: new Date(),
        values: [],
      });

      await expect(service.findBySlug('arm')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createValue', () => {
    it('should create a value for an attribute', async () => {
      (prisma.attributeValue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attributeValue.create as jest.Mock).mockResolvedValue({
        id: 'v1',
        attributeId: 'attr1',
        value: 'Fantasy',
        slug: 'fantasy',
      });

      const result = await service.createValue('attr1', { value: 'Fantasy' });

      expect(result.slug).toBe('fantasy');
    });

    it('should throw ConflictException for duplicate value in same attribute', async () => {
      (prisma.attributeValue.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing',
        deletedAt: null,
      });

      await expect(
        service.createValue('attr1', { value: 'Fantasy' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should filter findFirst by deletedAt: null to allow reuse after soft-delete', async () => {
      (prisma.attributeValue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attributeValue.create as jest.Mock).mockResolvedValue({
        id: 'v2',
        attributeId: 'attr1',
        value: 'Fantasy',
        slug: 'fantasy',
      });

      await service.createValue('attr1', { value: 'Fantasy' });

      const call = (prisma.attributeValue.findFirst as jest.Mock).mock
        .calls[0][0];
      expect(call.where.deletedAt).toBeNull();
    });
  });

  describe('deleteValue (soft)', () => {
    it('should set deletedAt and rename slug to free reuse', async () => {
      (prisma.attributeValue.findUnique as jest.Mock).mockResolvedValue({
        id: 'v1',
        slug: 'sword',
        deletedAt: null,
      });
      (prisma.attributeValue.update as jest.Mock).mockResolvedValue({});

      await service.deleteValue('v1');

      const call = (prisma.attributeValue.update as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'v1' });
      expect(call.data.deletedAt).toBeInstanceOf(Date);
      expect(call.data.slug).toMatch(/^sword__del__/);
      expect(prisma.attributeValue.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if value missing or already deleted', async () => {
      (prisma.attributeValue.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteValue('missing')).rejects.toThrow(
        NotFoundException,
      );

      (prisma.attributeValue.findUnique as jest.Mock).mockResolvedValue({
        id: 'v1',
        slug: 'sword',
        deletedAt: new Date(),
      });

      await expect(service.deleteValue('v1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete (soft)', () => {
    it('should set deletedAt on attribute and cascade-soft-delete its values + rename slugs', async () => {
      (prisma.attribute.findUnique as jest.Mock).mockResolvedValue({
        id: 'attr1',
        slug: 'arm',
        deletedAt: null,
      });
      (prisma.attribute.update as jest.Mock).mockResolvedValue({});

      await service.delete('attr1');

      const call = (prisma.attribute.update as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'attr1' });
      expect(call.data.deletedAt).toBeInstanceOf(Date);
      expect(call.data.slug).toMatch(/^arm__del__/);
      expect(call.data.values?.updateMany).toEqual({
        where: { deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.attribute.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if attribute missing or already deleted', async () => {
      (prisma.attribute.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(
        NotFoundException,
      );

      (prisma.attribute.findUnique as jest.Mock).mockResolvedValue({
        id: 'attr1',
        slug: 'arm',
        deletedAt: new Date(),
      });

      await expect(service.delete('attr1')).rejects.toThrow(NotFoundException);
    });
  });
});
