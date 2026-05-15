import { Test, TestingModule } from '@nestjs/testing';
import { SkuService } from './sku.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('SkuService', () => {
  let service: SkuService;

  const mockPrisma = {
    brand: {
      findUnique: jest.fn(),
    },
    skuCounter: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SkuService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SkuService>(SkuService);

    jest.clearAllMocks();
  });

  describe('previewNextSku', () => {
    it('should return SKU formatted with 4 digits when counter exists', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        skuPrefix: 'CNP',
        skuCounter: { counter: 41 },
      });

      const result = await service.previewNextSku('brand-1');

      expect(result).toBe('CNP0042');
      expect(mockPrisma.brand.findUnique).toHaveBeenCalledWith({
        where: { id: 'brand-1' },
        include: { skuCounter: true },
      });
    });

    it('should return SKU with counter 1 when counter does not exist yet', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        skuPrefix: '3D',
        skuCounter: null,
      });

      const result = await service.previewNextSku('brand-1');

      expect(result).toBe('3D0001');
    });

    it('should throw BadRequestException when brand does not have skuPrefix', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        skuPrefix: null,
        skuCounter: null,
      });

      await expect(service.previewNextSku('brand-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when brand does not exist', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.previewNextSku('brand-999')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should format correctly with large counter (>9999)', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        skuPrefix: 'AC',
        skuCounter: { counter: 99999 },
      });

      const result = await service.previewNextSku('brand-1');

      expect(result).toBe('AC100000');
    });
  });

  describe('commitSku', () => {
    it('should upsert counter extracting number from SKU', async () => {
      mockPrisma.skuCounter.upsert.mockResolvedValue({
        brandId: 'brand-1',
        counter: 42,
      });

      await service.commitSku('brand-1', 'CNP0042');

      expect(mockPrisma.skuCounter.upsert).toHaveBeenCalledWith({
        where: { brandId: 'brand-1' },
        create: { brandId: 'brand-1', counter: 42 },
        update: { counter: 42 },
      });
    });

    it('should update counter to higher value when manual SKU is higher', async () => {
      mockPrisma.skuCounter.upsert.mockResolvedValue({
        brandId: 'brand-1',
        counter: 100,
      });

      await service.commitSku('brand-1', 'CNP0100');

      expect(mockPrisma.skuCounter.upsert).toHaveBeenCalledWith({
        where: { brandId: 'brand-1' },
        create: { brandId: 'brand-1', counter: 100 },
        update: { counter: 100 },
      });
    });

    it('should do nothing if it cannot extract number from SKU', async () => {
      await service.commitSku('brand-1', 'MANUAL-SKU-WITHOUT-NUMBER');

      expect(mockPrisma.skuCounter.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getSkuForProduct', () => {
    it('should return manualSku when provided', async () => {
      const result = await service.getSkuForProduct('brand-1', 'MY-CUSTOM-SKU');

      expect(result).toBe('MY-CUSTOM-SKU');
      expect(mockPrisma.brand.findUnique).not.toHaveBeenCalled();
    });

    it('should generate SKU automatically when manualSku not provided', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        skuPrefix: 'CNP',
        skuCounter: { counter: 5 },
      });
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const result = await service.getSkuForProduct('brand-1');

      expect(result).toBe('CNP0006');
    });

    it('should return undefined if brand does not have skuPrefix and manualSku not provided', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        skuPrefix: null,
        skuCounter: null,
      });

      const result = await service.getSkuForProduct('brand-1');

      expect(result).toBeUndefined();
    });

    it('should increment if generated SKU already exists in database', async () => {
      mockPrisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        skuPrefix: 'CNP',
        skuCounter: { counter: 5 },
      });

      mockPrisma.product.findUnique
        .mockResolvedValueOnce({ id: 'existing' })

        .mockResolvedValueOnce(null);

      const result = await service.getSkuForProduct('brand-1');

      expect(result).toBe('CNP0007');
    });
  });
});
