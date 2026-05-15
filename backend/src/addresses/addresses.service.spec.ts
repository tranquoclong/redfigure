import { Test, TestingModule } from '@nestjs/testing';
import { AddressesService } from './addresses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { it } from 'node:test';

describe('AddressesService', () => {
  let service: AddressesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        {
          provide: PrismaService,
          useValue: {
            address: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const userId = 'user1';
  const mockAddress = {
    id: 'addr1',
    userId,
    street: 'street',
    ward: 'ward',
    district: 'district',
    province: 'province',
    postalCode: '70000000',
    country: 'VN',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('findAll', () => {
    it('should return all addresses for the user', async () => {
      (prisma.address.findMany as jest.Mock).mockResolvedValue([mockAddress]);

      const result = await service.findAll(userId);

      expect(result).toHaveLength(1);
      expect(prisma.address.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { isDefault: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return an address belonging to the user', async () => {
      (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);

      const result = await service.findOne('addr1', userId);

      expect(result).toEqual(mockAddress);
    });

    it('should throw NotFoundException if address does not exist', async () => {
      (prisma.address.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if address belongs to another user', async () => {
      (prisma.address.findUnique as jest.Mock).mockResolvedValue({
        ...mockAddress,
        userId: 'other_user',
      });

      await expect(service.findOne('addr1', userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('should create an address for the user', async () => {
      (prisma.address.count as jest.Mock).mockResolvedValue(1);
      (prisma.address.create as jest.Mock).mockResolvedValue(mockAddress);

      const dto = {
        street: 'street',
        number: '123',
        ward: 'ward',
        district: 'district',
        province: 'province',
        postalCode: '70000000',
      };

      const result = await service.create(userId, dto);

      expect(result).toEqual(mockAddress);
      expect(prisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          street: dto.street,
        }),
      });
    });

    it('the first address of the user is forced to be set to isDefault = true (the backend does not trust the client)', async () => {
      (prisma.address.count as jest.Mock).mockResolvedValue(0);
      (prisma.address.create as jest.Mock).mockResolvedValue({
        ...mockAddress,
        isDefault: true,
      });
      await service.create(userId, {
        street: 'street',
        number: '1',
        ward: 'ward',
        district: 'district',
        province: 'province',
        postalCode: '70000000',
        isDefault: false,
      });

      const call = (prisma.address.create as jest.Mock).mock.calls[0][0];
      expect(call.data.isDefault).toBe(true);
    });

    it('subsequent isDefault respects the client (false = does not become the default)', async () => {
      (prisma.address.count as jest.Mock).mockResolvedValue(2);
      (prisma.address.create as jest.Mock).mockResolvedValue(mockAddress);

      await service.create(userId, {
        street: 'street',
        number: '1',
        ward: 'ward',
        district: 'district',
        province: 'province',
        postalCode: '70000000',
        isDefault: false,
      });

      const call = (prisma.address.create as jest.Mock).mock.calls[0][0];
      expect(call.data.isDefault).toBe(false);
      expect(prisma.address.updateMany).not.toHaveBeenCalled();
    });

    it('should accept optional name field (e.g. "home", "work")', async () => {
      (prisma.address.count as jest.Mock).mockResolvedValue(1);
      (prisma.address.create as jest.Mock).mockResolvedValue({
        ...mockAddress,
        name: 'home',
      });

      await service.create(userId, {
        street: 'Street',
        number: '123',
        ward: 'ward',
        district: 'district',
        province: 'province',
        postalCode: '70000000',
        name: 'home',
      });

      expect(prisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'home' }),
      });
    });

    it('name is optional - create without name works', async () => {
      (prisma.address.count as jest.Mock).mockResolvedValue(1);
      (prisma.address.create as jest.Mock).mockResolvedValue(mockAddress);
      await service.create(userId, {
        street: 'Street',
        number: '123',
        ward: 'ward',
        district: 'district',
        province: 'province',
        postalCode: '70000000',
      });
      const call = (prisma.address.create as jest.Mock).mock.calls[0][0];
      expect(call.data.name).toBeUndefined();
    });

    it('should unset previous default when creating new default address', async () => {
      (prisma.address.count as jest.Mock).mockResolvedValue(1);
      (prisma.address.updateMany as jest.Mock).mockResolvedValue({});
      (prisma.address.create as jest.Mock).mockResolvedValue({
        ...mockAddress,
        isDefault: true,
      });

      await service.create(userId, {
        street: 'New Street',
        number: '456',
        ward: 'ward',
        district: 'district',
        province: 'province',
        postalCode: '70000000',
        isDefault: true,
      });

      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('update', () => {
    it('should update address belonging to the user', async () => {
      (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);
      (prisma.address.update as jest.Mock).mockResolvedValue({
        ...mockAddress,
        number: '999',
      });

      const result = await service.update('addr1', userId, { number: '999' });

      expect(result.number).toBe('999');
    });

    it('should throw ForbiddenException if address belongs to another user', async () => {
      (prisma.address.findUnique as jest.Mock).mockResolvedValue({
        ...mockAddress,
        userId: 'other_user',
      });

      await expect(
        service.update('addr1', userId, { number: '999' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should unset previous default when marking as default', async () => {
      (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);
      (prisma.address.updateMany as jest.Mock).mockResolvedValue({});
      (prisma.address.update as jest.Mock).mockResolvedValue({
        ...mockAddress,
        isDefault: true,
      });

      await service.update('addr1', userId, { isDefault: true });

      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('remove', () => {
    it('should delete address belonging to the user', async () => {
      (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);
      (prisma.address.count as jest.Mock).mockResolvedValue(2);
      (prisma.address.delete as jest.Mock).mockResolvedValue(mockAddress);

      await service.remove('addr1', userId);

      expect(prisma.address.delete).toHaveBeenCalledWith({
        where: { id: 'addr1' },
      });
    });

    it('should throw ForbiddenException if address belongs to another user', async () => {
      (prisma.address.findUnique as jest.Mock).mockResolvedValue({
        ...mockAddress,
        userId: 'other_user',
      });

      await expect(service.remove('addr1', userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if it is the only address', async () => {
      (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);
      (prisma.address.count as jest.Mock).mockResolvedValue(1);

      await expect(service.remove('addr1', userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
