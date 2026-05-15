import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) { }

  private async getAddressAndVerifyOwner(id: string, userId: string) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return address;
  }

  async findAll(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    return this.getAddressAndVerifyOwner(id, userId);
  }

  async create(
    userId: string,
    dto: {
      name?: string;
      street: string;
      ward: string;
      district: string;
      province: string;
      postalCode?: string;
      isDefault?: boolean;
    },
  ) {
    const existingCount = await this.prisma.address.count({ where: { userId } });
    const isDefault = existingCount === 0 ? true : (dto.isDefault ?? false);

    if (isDefault && existingCount > 0) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        userId,
        name: dto.name,
        street: dto.street,
        ward: dto.ward,
        district: dto.district,
        province: dto.province,
        postalCode: dto.postalCode,
        isDefault,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    dto: {
      name?: string;
      street?: string;
      ward?: string;
      district?: string;
      province?: string;
      isDefault?: boolean;
    },
  ) {
    await this.getAddressAndVerifyOwner(id, userId);

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    await this.getAddressAndVerifyOwner(id, userId);

    const count = await this.prisma.address.count({ where: { userId } });
    if (count <= 1) {
      throw new BadRequestException(
        'Cannot delete the only address. Add another address first.',
      );
    }

    return this.prisma.address.delete({ where: { id } });
  }
}
