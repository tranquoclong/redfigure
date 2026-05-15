import { Test, TestingModule } from '@nestjs/testing';
import { VariationsService } from './variations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('VariationsService', () => {
  let service: VariationsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariationsService,
        {
          provide: PrismaService,
          useValue: {
            productVariation: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            product: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<VariationsService>(VariationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findByProduct', () => {
    it('should return only non-deleted variations for a product', async () => {
      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([
        { id: 'v1', name: '28mm', price: 49.9, stock: 10 },
      ]);

      const result = await service.findByProduct('prod1');

      expect(result).toHaveLength(1);
      expect(prisma.productVariation.findMany).toHaveBeenCalledWith({
        where: { productId: 'prod1', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('should create a variation for existing product', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
      });
      (prisma.productVariation.create as jest.Mock).mockResolvedValue({
        id: 'v1',
        productId: 'prod1',
        name: 'Heroic 28mm',
        sku: 'WAR-28',
        price: 49.9,
        stock: 10,
      });

      const result = await service.create('prod1', {
        name: 'Heroic 28mm',
        sku: 'WAR-28',
        price: 49.9,
        stock: 10,
      });

      expect(result.sku).toBe('WAR-28');
    });

    it('should throw NotFoundException if product does not exist', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create('nonexistent', {
          name: 'Test',
          sku: 'T-1',
          price: 10,
          stock: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update variation price and stock', async () => {
      (prisma.productVariation.findUnique as jest.Mock).mockResolvedValue({
        id: 'v1',
        productId: 'prod1',
      });
      (prisma.productVariation.update as jest.Mock).mockResolvedValue({
        id: 'v1',
        price: 59.9,
        stock: 20,
      });

      const result = await service.update('v1', { price: 59.9, stock: 20 });

      expect(result.price).toBe(59.9);
    });
  });

  describe('remove (soft)', () => {
    it('should soft-delete and never hard-delete (FK-safe for OrderItem history)', async () => {
      (prisma.productVariation.findUnique as jest.Mock).mockResolvedValue({
        id: 'v1',
        productId: 'prod1',
        deletedAt: null,
      });
      (prisma.productVariation.update as jest.Mock).mockResolvedValue({});

      await service.remove('v1');

      const call = (prisma.productVariation.update as jest.Mock).mock
        .calls[0][0];
      expect(call.where).toEqual({ id: 'v1' });
      expect(call.data.deletedAt).toBeInstanceOf(Date);
      expect(prisma.productVariation.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if variation missing or already deleted', async () => {
      (prisma.productVariation.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );

      (prisma.productVariation.findUnique as jest.Mock).mockResolvedValue({
        id: 'v1',
        deletedAt: new Date(),
      });
      await expect(service.remove('v1')).rejects.toThrow(NotFoundException);
    });
  });
});
