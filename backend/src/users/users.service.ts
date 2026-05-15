import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordPolicyService } from '../auth/password-policy.service';
import { SettingsService } from '../settings/settings.service';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  cccd: true,
  phone: true,
  mst: true,
  companyName: true,
  isActive: true,
  emailMarketingOptOut: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface BusinessFields {
  mst?: string;
  companyName?: string;
}

const MINIMAL_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  emailMarketingOptOut: true,

  passwordSet: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private passwordPolicy: PasswordPolicyService,
    private settings: SettingsService,
  ) { }

  private async assertBusinessAllowed(
    userId: string,
    dto: BusinessFields & { cccd?: string | null },
  ) {
    const isBusinessFieldSet = (v: unknown) =>
      v !== undefined && v !== null && v !== '';
    const wantsActiveBusiness =
      isBusinessFieldSet(dto.mst) ||
      isBusinessFieldSet(dto.companyName);

    const touchesIdentity =
      dto.cccd !== undefined ||
      dto.mst !== undefined ||
      dto.companyName !== undefined;
    if (!touchesIdentity) return;

    if (wantsActiveBusiness) {
      const allowed = await this.settings.getAcceptBusinessCustomers();
      if (!allowed) {
        throw new BadRequestException(
          'Customer registration as Business is disabled.',
        );
      }
    }

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        cccd: true,
        mst: true,
      },
    });
    if (!current) {
      throw new NotFoundException('User not found');
    }

    const norm = <T>(v: T) => {
      if (typeof v === 'string') {
        const trimmed = v.trim();
        return (trimmed === '' ? null : trimmed) as T extends string
          ? string | null
          : T;
      }
      return v as T extends string ? string | null : T;
    };
    const finalCccd = dto.cccd !== undefined ? norm(dto.cccd) : current.cccd;
    const finalMst = dto.mst !== undefined ? norm(dto.mst) : current.mst;

    if (current.cccd) {
      if (finalMst) {
        throw new BadRequestException(
          'This account is registered as a natural person (CCCD). To purchase as a business, create a new account.',
        );
      }
      if (!finalCccd) {
        throw new BadRequestException(
          'Cannot remove CCCD from an account registered as a natural person.',
        );
      }
      if (finalCccd !== current.cccd) {
        throw new BadRequestException(
          'Cannot change registered CCCD. To use another CCCD, create a new account.',
        );
      }
    }
    if (current.mst) {
      if (finalCccd) {
        throw new BadRequestException(
          'This account is registered as a legal entity (MST). To purchase as a PF, create a new account.',
        );
      }
      if (!finalMst) {
        throw new BadRequestException(
          'Cannot remove MST from an account registered as a legal entity.',
        );
      }
      if (finalMst !== current.mst) {
        throw new BadRequestException(
          'Cannot change registered MST. To use another MST, create a new account.',
        );
      }
    }

    if (finalCccd && finalMst) {
      throw new BadRequestException(
        'Use CCCD or MST, not both in the same account.',
      );
    }
  }

  async getMinimalProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: MINIMAL_USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findAll(params: { page: number; perPage: number; search?: string }) {
    const { page, perPage, search } = params;
    const skip = (page - 1) * perPage;

    const where: Record<string, any> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cccd: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_SELECT,
          _count: { select: { orders: true } },
          orders: {
            where: {
              deletedAt: null,
              status: { notIn: ['PENDING', 'CANCELLED'] },
            },
            select: { total: true },
          },
        },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const enriched = data.map((user) => {

      const totalSpent =
        (user as any).orders?.reduce(

          (sum: number, o: { total: number }) => sum + o.total,
          0,
        ) ?? 0;
      const { orders: _orders, ...rest } = user as any;

      return { ...rest, totalSpent: Math.round(totalSpent * 100) / 100 };
    });

    return {
      data: enriched,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async adminGetUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_SELECT,
        lastLoginAt: true,
        _count: { select: { orders: true } },
        orders: {
          where: {
            deletedAt: null,
            status: { notIn: ['PENDING', 'CANCELLED'] },
          },
          select: { total: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const totalSpent =
      (user as any).orders?.reduce(

        (sum: number, o: { total: number }) => sum + o.total,
        0,
      ) ?? 0;
    const { orders: _orders, ...rest } = user as any;
    return { ...rest, totalSpent: Math.round(totalSpent * 100) / 100 };
  }

  async updateProfile(
    userId: string,
    dto: {
      name?: string;
      email?: string;
      cccd?: string;
      phone?: string;
    } & BusinessFields,
  ) {

    await this.assertBusinessAllowed(userId, dto);
    const {
      name,
      email,
      cccd,
      phone,
      mst,
      companyName,
    } = dto;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (cccd !== undefined) data.cccd = cccd;
    if (phone !== undefined) data.phone = phone;
    if (mst !== undefined) data.mst = mst;
    if (companyName !== undefined) data.companyName = companyName;
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
        select: USER_SELECT,
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {

        throw new ConflictException({
          message: formatUniqueViolationMessage(),
          errorCode: 'DUPLICATE_USER_FIELD',
        });
      }

      if (
        err?.code === 'P2010' ||
        err?.code === 'P2029' ||
        err?.meta?.code === '23514'
      ) {
        throw new BadRequestException(
          'Data conflict: please check CCCD/MST and state registration.',
        );
      }
      throw err;
    }
  }

  async adminUpdateUser(
    userId: string,
    dto: {
      name?: string;
      email?: string;
      cccd?: string;
      phone?: string;
      isActive?: boolean;
    } & BusinessFields,
    adminId?: string,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (adminId && adminId === userId && dto.isActive === false) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    await this.assertBusinessAllowed(userId, dto);

    const {
      name,
      email,
      cccd,
      phone,
      isActive,
      mst,
      companyName,
    } = dto;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (cccd !== undefined) data.cccd = cccd;
    if (phone !== undefined) data.phone = phone;
    if (isActive !== undefined) data.isActive = isActive;
    if (mst !== undefined) data.mst = mst;
    if (companyName !== undefined) data.companyName = companyName;
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
        select: USER_SELECT,
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {

        throw new ConflictException({
          message: formatUniqueViolationMessage(),
          errorCode: 'DUPLICATE_USER_FIELD',
        });
      }

      if (
        err?.code === 'P2010' ||
        err?.code === 'P2029' ||
        err?.meta?.code === '23514'
      ) {
        throw new BadRequestException(
          'Data conflict: please check CCCD/MST and state registration.',
        );
      }
      throw err;
    }
  }

  async adminGetUserAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminGetUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        createdAt: true,
        paymentMethod: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatch = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!passwordMatch) {
      throw new BadRequestException('Incorrect current password.');
    }

    await this.passwordPolicy.validate(
      dto.newPassword,
      user.role as 'ADMIN' | 'CUSTOMER',
    );

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async updateEmailPreferences(
    userId: string,
    dto: { emailMarketingOptOut: boolean },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailMarketingOptOut: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isReactivating =
      user.emailMarketingOptOut === true && dto.emailMarketingOptOut === false;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailMarketingOptOut: dto.emailMarketingOptOut,
        ...(isReactivating
          ? { unsubscribeTokenVersion: { increment: 1 } }
          : {}),
      },
      select: USER_SELECT,
    });
  }
}

function formatUniqueViolationMessage(): string {
  return 'An account with these unique details (email, CCCD, or MST) already exists.';
}
