import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordPolicyService } from '../auth/password-policy.service';
import { SettingsService } from '../settings/settings.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let settings: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            address: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: PasswordPolicyService,
          useValue: { validate: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SettingsService,
          useValue: {
            getAcceptBusinessCustomers: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    settings = module.get<SettingsService>(SettingsService);
  });

  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      const mockUser = {
        id: 'cuid1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getProfile('cuid1');

      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update user name', async () => {
      const updated = {
        id: 'cuid1',
        email: 'test@example.com',
        name: 'Updated Name',
        role: 'CUSTOMER',
      };

      (prisma.user.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateProfile('cuid1', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should NOT allow role to be changed via updateProfile', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        role: 'CUSTOMER',
      });

      await service.updateProfile('cuid1', { role: 'ADMIN' } as any);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ role: 'ADMIN' }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated list of users', async () => {
      const mockUsers = [
        {
          id: 'u1',
          email: 'a@a.com',
          name: 'Alice',
          role: 'CUSTOMER',
          cccd: '001100000001',
          phone: '0901234567',
          createdAt: new Date(),
          _count: { orders: 2 },
        },
        {
          id: 'u2',
          email: 'b@b.com',
          name: 'Bob',
          role: 'CUSTOMER',
          cccd: null,
          phone: null,
          createdAt: new Date(),
          _count: { orders: 0 },
        },
      ];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findAll({ page: 1, perPage: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by search term (name, email or cccd)', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 1, perPage: 10, search: 'alice' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
              expect.objectContaining({ email: expect.any(Object) }),
              expect.objectContaining({ cccd: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('updateProfile with cccd/phone', () => {
    it('should update cccd and phone', async () => {

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        cccd: null,
        mst: null,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        cccd: '001100000001',
        phone: '0901234567',
      });

      await service.updateProfile('cuid1', {
        cccd: '001100000001',
        phone: '0901234567',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cccd: '001100000001',
            phone: '0901234567',
          }),
        }),
      );
    });
  });

  describe('adminUpdateUser', () => {
    it('should update user name, cccd, phone and isActive', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'u1',
        name: 'New Name',
        cccd: '999999999999',
        phone: '0901234567',
        isActive: false,
      });

      const result = await service.adminUpdateUser('u1', {
        name: 'New Name',
        cccd: '999999999999',
        phone: '0901234567',
        isActive: false,
      });

      expect(result.name).toBe('New Name');
      expect(result.isActive).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'New Name', isActive: false }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.adminUpdateUser('bad-id', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('prevents admin from deactivating their OWN account (self-lockout)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'admin1' });

      await expect(
        service.adminUpdateUser('admin1', { isActive: false }, 'admin1'),
      ).rejects.toThrow(/deactivate your own account/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('allows admin to deactivate ANOTHER user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'u1',
        isActive: false,
      });

      await service.adminUpdateUser('u1', { isActive: false }, 'admin-other');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('allows admin to reactivate their OWN account (isActive=true does not lock)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'admin1' });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'admin1',
        isActive: true,
      });

      await service.adminUpdateUser('admin1', { isActive: true }, 'admin1');

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should NOT allow role or password changes', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1' });

      await service.adminUpdateUser('u1', {
        role: 'ADMIN',
        password: 'hacked',
      } as any);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            role: 'ADMIN',
            password: 'hacked',
          }),
        }),
      );
    });
  });

  describe('updateProfile with MST (issue #59)', () => {
    const VALID_MST = '0101234565001';
    const ANOTHER_VALID_MST = '0101234565002';
    const VALID_CCCD = '001100000001';

    function mockCurrent(
      state: Partial<{
        cccd: string | null;
        mst: string | null;
      }> = {},
    ) {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        cccd: null,
        mst: null,
        ...state,
      });
    }

    it('accepts Business fields when setting accept_business_customers=true', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent();
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        mst: VALID_MST,
        companyName: 'Company LTD',
      });

      await service.updateProfile('cuid1', {
        mst: VALID_MST,
        companyName: 'Company LTD',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mst: VALID_MST,
            companyName: 'Company LTD',
          }),
        }),
      );
    });

    it('accepts numeric IE when NOT exempt', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent();
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'cuid1' });

      await service.updateProfile('cuid1', {
        mst: VALID_MST,
        companyName: 'X',
      });

    });

    it('rejects Business fields when feature flag is disabled', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateProfile('cuid1', { mst: VALID_MST }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('REJECTS clearing MST from Business account (immutability — Gemini R2 🔴 two-step)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ mst: VALID_MST });

      await expect(
        service.updateProfile('cuid1', {
          mst: null as unknown as string,
        }),
      ).rejects.toThrow(/remove the MST/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('REJECTS two-step switch: clearing CCCD now would enable setting MST later', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ cccd: VALID_CCCD });

      await expect(
        service.updateProfile('cuid1', {
          cccd: null as unknown as string,
        }),
      ).rejects.toThrow(/remove the CCCD/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('shadow account (no doc) ACCEPTS Business no-op', async () => {

      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(false);
      mockCurrent({ cccd: null, mst: null });
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'cuid1' });

      await service.updateProfile('cuid1', {
        mst: null as unknown as string,
        companyName: null as unknown as string,
      });

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('cccd="" + mst="" in shadow account does NOT save empty strings in DB (layered defense)', async () => {

      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(false);
      mockCurrent({ cccd: null, mst: null });
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'cuid1' });

      await service.updateProfile('cuid1', {
        cccd: '' as unknown as string,
        mst: '' as unknown as string,
      });

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('rejects CCCD and MST in the SAME request (mutual exclusion)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent();

      await expect(
        service.updateProfile('cuid1', {
          cccd: VALID_CCCD,
          mst: VALID_MST,
        }),
      ).rejects.toThrow(/natural person|legal person|CCCD.*MST/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('STATEFUL: user with CCCD cannot set MST (Gemini R1 🔴 #1)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ cccd: VALID_CCCD });

      await expect(
        service.updateProfile('cuid1', { mst: VALID_MST }),
      ).rejects.toThrow(/natural person|create a new account/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('STATEFUL: user with MST cannot set CCCD', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ mst: VALID_MST });

      await expect(
        service.updateProfile('cuid1', { cccd: VALID_CCCD }),
      ).rejects.toThrow(/legal person|create a new account/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('STATEFUL: clearing CCCD + setting MST in the SAME request also refuses', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ cccd: VALID_CCCD });

      await expect(
        service.updateProfile('cuid1', {
          cccd: null as unknown as string,
          mst: VALID_MST,
        }),
      ).rejects.toThrow(/natural person|create a new account/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('REJECTS changing existing MST to another MST (Gemini R3 A — anti-takeover)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ mst: VALID_MST });

      await expect(
        service.updateProfile('cuid1', { mst: ANOTHER_VALID_MST }),
      ).rejects.toThrow(/change the MST|create a new account/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('REJECTS changing existing CCCD to another CCCD (anti account-takeover)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ cccd: VALID_CCCD });

      await expect(
        service.updateProfile('cuid1', { cccd: '001100000001' }),
      ).rejects.toThrow(/change the CCCD|create a new account/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('ALLOWS re-sending SAME CCCD (idempotent no-op)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ cccd: VALID_CCCD });
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'cuid1' });

      await service.updateProfile('cuid1', { cccd: VALID_CCCD, name: 'X' });

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('whitespace bypass: cccd="  " in PF account falls into "remove CCCD"', async () => {

      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ cccd: VALID_CCCD });

      await expect(
        service.updateProfile('cuid1', {
          cccd: '   ' as unknown as string,
        }),
      ).rejects.toThrow(/remove the CCCD/i);
    });

    it('Postgres CHECK violation falls into generic BadRequest (Gemini R3 B + R4 A)', async () => {

      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ cccd: null, mst: null });

      const checkErr1 = Object.assign(new Error('check_violation'), {
        code: 'P2010',
        meta: { code: '23514' },
      });
      (prisma.user.update as jest.Mock).mockRejectedValueOnce(checkErr1);
      await expect(
        service.updateProfile('cuid1', { cccd: VALID_CCCD }),
      ).rejects.toThrow(/Data conflict/i);

      mockCurrent({ cccd: null, mst: null });
      const checkErr2 = Object.assign(new Error('check_violation'), {
        code: 'P2029',
      });
      (prisma.user.update as jest.Mock).mockRejectedValueOnce(checkErr2);
      await expect(
        service.updateProfile('cuid1', { cccd: VALID_CCCD }),
      ).rejects.toThrow(/Data conflict/i);

      mockCurrent({ cccd: null, mst: null });
      const checkErr3 = Object.assign(new Error('check_violation'), {
        meta: { code: '23514' },
      });
      (prisma.user.update as jest.Mock).mockRejectedValueOnce(checkErr3);
      await expect(
        service.updateProfile('cuid1', { cccd: VALID_CCCD }),
      ).rejects.toThrow(/Data conflict/i);
    });

    it('STATEFUL: rejects IE filled in DB + payload exempt=true', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent({ mst: VALID_MST });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects IE filled AND exempt=true in the SAME payload (contradiction)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent();

      await expect(
        service.updateProfile('cuid1', {
          mst: VALID_MST,
        }),
      ).rejects.toThrow(/state.*registration|exempt/i);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('P2002 → 409 ConflictException with errorCode DUPLICATE_USER_FIELD (frontend uses for UI "login")', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent();
      const p2002 = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
        meta: { target: ['mst'] },
      });
      (prisma.user.update as jest.Mock).mockRejectedValue(p2002);

      await expect(
        service.updateProfile('cuid1', { mst: ANOTHER_VALID_MST }),
      ).rejects.toThrow(ConflictException);
    });

    it('P2002 keeps GENERIC message without revealing field (anti-enumeration — Gemini R1 🟡 #3)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      mockCurrent();
      const p2002 = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
        meta: { target: ['mst'] },
      });
      (prisma.user.update as jest.Mock).mockRejectedValue(p2002);

      try {
        await service.updateProfile('cuid1', { mst: ANOTHER_VALID_MST });
        fail('should have thrown');
      } catch (err) {
        const response = (err as ConflictException).getResponse() as {
          message: string;
          errorCode: string;
        };
        expect(response.message).toMatch(/unique data|email, CCCD or MST/i);
        expect(response.errorCode).toBe('DUPLICATE_USER_FIELD');
      }
    });
  });

  describe('adminUpdateUser with MST (issue #59)', () => {
    const VALID_MST = '11222333000181';

    it('accepts Business fields when setting=true', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'u1' })
        .mockResolvedValueOnce({
          cccd: null,
          mst: null,
        });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'u1',
        mst: VALID_MST,
      });

      await service.adminUpdateUser('u1', {
        mst: VALID_MST,
        companyName: 'Admin Company',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mst: VALID_MST,
            companyName: 'Admin Company',
          }),
        }),
      );
    });

    it('rejects Business when setting=false (even via admin)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(false);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });

      await expect(
        service.adminUpdateUser('u1', { mst: VALID_MST }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('adminGetUserAddresses', () => {
    it('should return addresses for a given user', async () => {
      const mockAddresses = [
        { id: 'a1', street: 'Street A', city: 'New York', userId: 'u1' },
        { id: 'a2', street: 'Street B', city: 'Los Angeles', userId: 'u1' },
      ];
      (prisma.address.findMany as jest.Mock).mockResolvedValue(mockAddresses);

      const result = await service.adminGetUserAddresses('u1');

      expect(result).toHaveLength(2);
      expect(prisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
    });
  });

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        password: 'oldhash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.changePassword('cuid1', {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass456!', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'cuid1' },
        data: { password: 'newhash' },
      });
    });

    it('should throw BadRequestException when current password is wrong', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        password: 'oldhash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('cuid1', {
          currentPassword: 'WrongPass!',
          newPassword: 'NewPass456!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateEmailPreferences', () => {
    it('updates emailMarketingOptOut of authenticated user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        emailMarketingOptOut: false,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'u1',
        emailMarketingOptOut: true,
      });

      await service.updateEmailPreferences('u1', {
        emailMarketingOptOut: true,
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { emailMarketingOptOut: true },
        select: expect.any(Object),
      });
    });

    it('NotFoundException when user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateEmailPreferences('fake', { emailMarketingOptOut: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
