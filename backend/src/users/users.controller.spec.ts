import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UnsubscribeService } from './unsubscribe.service';
import { SettingsService } from '../settings/settings.service';
import { SetBusinessSettingsDto } from './dto/set-business-settings.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let settings: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getProfile: jest.fn(),
            updateProfile: jest.fn(),
            changePassword: jest.fn(),
            updateEmailPreferences: jest.fn(),
          },
        },
        {
          provide: UnsubscribeService,
          useValue: { generateToken: jest.fn(), consume: jest.fn() },
        },
        {
          provide: SettingsService,
          useValue: {
            getAcceptBusinessCustomers: jest.fn(),
            setAcceptBusinessCustomers: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    settings = module.get<SettingsService>(SettingsService);
  });

  const mockUser = {
    id: 'cuid1',
    email: 'test@example.com',
    name: 'Test',
    role: 'CUSTOMER',
  };

  describe('GET /api/v1/users/me', () => {
    it('should return MINIMAL current user profile (without PII — LGPD)', async () => {

      (service.getMinimalProfile as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockUser);

      const result = await controller.getMinimalProfile(mockUser);

      expect(result).toEqual({ data: mockUser });
      expect(service.getMinimalProfile).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('GET /api/v1/users/me/profile', () => {
    it('should return FULL profile with cccd+phone', async () => {
      const fullProfile = {
        ...mockUser,
        cccd: '001100000001',
        phone: '0901234567',
      };
      (service.getProfile as jest.Mock).mockResolvedValue(fullProfile);

      const result = await controller.getFullProfile(mockUser);

      expect(result).toEqual({ data: fullProfile });
      expect(service.getProfile).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('PUT /api/v1/users/me', () => {
    it('should update and return user profile', async () => {
      const dto = { name: 'Updated' };
      const updated = { ...mockUser, name: 'Updated' };
      (service.updateProfile as jest.Mock).mockResolvedValue(updated);

      const result = await controller.updateProfile(mockUser, dto);

      expect(result).toEqual({ data: updated });
    });
  });

  describe('PUT /api/v1/users/me/password', () => {
    it('should change password and return success message', async () => {
      const dto = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      };
      (service.changePassword as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.changePassword(mockUser, dto);

      expect(result).toEqual({
        data: { message: 'Password changed successfully' },
      });
    });
  });

  describe('admin/business-settings — toggle accept_business_customers (issue #59)', () => {
    it('GET returns { enabled } with current flag', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(true);
      const result = await controller.getBusinessSettings();
      expect(result).toEqual({ data: { enabled: true } });
    });

    it('GET returns false when setting does not exist (fail-closed)', async () => {
      (settings.getAcceptBusinessCustomers as jest.Mock).mockResolvedValue(false);
      const result = await controller.getBusinessSettings();
      expect(result).toEqual({ data: { enabled: false } });
    });

    it('PUT { enabled: true } persists and returns ok', async () => {
      (settings.setAcceptBusinessCustomers as jest.Mock).mockResolvedValue(undefined);
      const result = await controller.setBusinessSettings({ enabled: true });
      expect(settings.setAcceptBusinessCustomers).toHaveBeenCalledWith(true);
      expect(result).toEqual({ data: { enabled: true } });
    });

    it('PUT { enabled: false } persists', async () => {
      (settings.setAcceptBusinessCustomers as jest.Mock).mockResolvedValue(undefined);
      const result = await controller.setBusinessSettings({ enabled: false });
      expect(settings.setAcceptBusinessCustomers).toHaveBeenCalledWith(false);
      expect(result).toEqual({ data: { enabled: false } });
    });

    it('SetBusinessSettingsDto rejects non-boolean enabled (validation via class-validator)', async () => {

      const dto = plainToInstance(SetBusinessSettingsDto, { enabled: 'yes' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toMatchObject({
        isBoolean: expect.any(String),
      });
    });
  });

  describe('POST /api/v1/users/unsubscribe/one-click (RFC 8058)', () => {
    let unsubscribeService: { consume: jest.Mock };

    beforeEach(() => {
      unsubscribeService = (controller as any).unsubscribeService as {
        consume: jest.Mock;
      };
    });

    it('rejects without token', async () => {
      await expect(
        controller.unsubscribeOneClick('', 'One-Click'),
      ).rejects.toThrow('Token required');
    });

    it('rejects body without List-Unsubscribe=One-Click (anti crawler/scanner)', async () => {
      await expect(
        controller.unsubscribeOneClick('valid-token', undefined),
      ).rejects.toThrow('Invalid one-click payload');
      expect(unsubscribeService.consume).not.toHaveBeenCalled();
    });

    it('rejects body with wrong value', async () => {
      await expect(
        controller.unsubscribeOneClick('valid-token', 'wrong-value'),
      ).rejects.toThrow('Invalid one-click payload');
    });

    it('calls consume(token) when body is valid One-Click', async () => {
      unsubscribeService.consume.mockResolvedValue(undefined);
      const result = await controller.unsubscribeOneClick(
        'valid-token',
        'One-Click',
      );
      expect(unsubscribeService.consume).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual({ data: { message: 'Unsubscribed' } });
    });
  });
});
