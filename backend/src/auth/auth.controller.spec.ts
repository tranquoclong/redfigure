import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SecurityService } from '../security/security.service';
import { GoogleOAuthService } from './google-oauth.service';
import { SettingsService } from '../settings/settings.service';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './cookie.helper';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  function mockRequest(cookies: Record<string, string> = {}): Request {
    return {
      cookies,
      ip: '127.0.0.1',
      headers: {},
    } as unknown as Request;
  }

  function mockResponse() {
    return {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response & {
      cookie: jest.Mock;
      clearCookie: jest.Mock;
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
            revokeRefreshTokenFamily: jest.fn(),
          },
        },
        {
          provide: SecurityService,
          useValue: {
            recordFailedAttempt: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: GoogleOAuthService,
          useValue: {
            getAuthUrl: jest.fn(),
            exchangeCode: jest.fn(),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getGoogleOAuthConfig: jest.fn().mockResolvedValue({
              enabled: false,
              clientId: null,
              clientSecret: null,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  describe('POST /api/v1/auth/register', () => {
    it('should return user data wrapped in { data }', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const mockResult = {
        id: 'cuid1',
        email: dto.email,
        name: dto.name,
        role: 'CUSTOMER',
        createdAt: new Date(),
      };

      (service.register as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.register(dto);

      expect(result).toEqual({ data: mockResult });
      expect(service.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('sets refresh cookie and returns only accessToken + user in body', async () => {
      const dto = { email: 'test@example.com', password: 'SecurePass123!' };
      const req = mockRequest();
      const res = mockResponse();

      (service.login as jest.Mock).mockResolvedValue({
        accessToken: 'access_token',
        refreshToken: 'refresh_token_xyz',
        user: { id: '1', email: dto.email, name: 'Test', role: 'CUSTOMER' },
      });

      const result = await controller.login(dto, req, res);

      expect(result).toEqual({
        data: {
          accessToken: 'access_token',
          user: { id: '1', email: dto.email, name: 'Test', role: 'CUSTOMER' },
        },
      });

      expect(
        (result.data as Record<string, unknown>).refreshToken,
      ).toBeUndefined();
      expect(service.login).toHaveBeenCalledWith(dto);

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        'refresh_token_xyz',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: REFRESH_COOKIE_PATH,
        }),
      );
    });

    it('records failed attempt and throws on invalid credentials', async () => {
      const dto = { email: 'wrong@example.com', password: 'bad' };
      const req = mockRequest();
      const res = mockResponse();
      const securityService = (
        controller as unknown as {
          securityService: { recordFailedAttempt: jest.Mock };
        }
      ).securityService;

      (service.login as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid email or password'),
      );

      await expect(controller.login(dto, req, res)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(securityService.recordFailedAttempt).toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('reads refresh from cookie, rotates, sets new cookie, returns only accessToken', async () => {
      const req = mockRequest({ [REFRESH_COOKIE_NAME]: 'old_refresh' });
      const res = mockResponse();

      (service.refreshToken as jest.Mock).mockResolvedValue({
        accessToken: 'new_access',
        refreshToken: 'new_refresh',
      });

      const result = await controller.refresh(req, res);

      expect(result).toEqual({ data: { accessToken: 'new_access' } });
      expect(
        (result.data as Record<string, unknown>).refreshToken,
      ).toBeUndefined();
      expect(service.refreshToken).toHaveBeenCalledWith('old_refresh');
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        'new_refresh',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
    });

    it('throws 401 when cookie is missing (does not accept body)', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.refreshToken).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('clears cookie and revokes family when token is present', async () => {
      const req = mockRequest({ [REFRESH_COOKIE_NAME]: 'some_token' });
      const res = mockResponse();

      (service.revokeRefreshTokenFamily as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.logout(req, res);

      expect(result).toEqual({ data: { success: true } });
      expect(res.clearCookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        expect.objectContaining({ httpOnly: true, path: REFRESH_COOKIE_PATH }),
      );
      expect(service.revokeRefreshTokenFamily).toHaveBeenCalledWith(
        'some_token',
      );
    });

    it('clears cookie even without token (logout idempotent)', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      const result = await controller.logout(req, res);

      expect(result).toEqual({ data: { success: true } });
      expect(res.clearCookie).toHaveBeenCalled();
      expect(service.revokeRefreshTokenFamily).not.toHaveBeenCalled();
    });

    it('swallows revoke error to not leak token validity (probe)', async () => {
      const req = mockRequest({ [REFRESH_COOKIE_NAME]: 'invalid_token' });
      const res = mockResponse();

      (service.revokeRefreshTokenFamily as jest.Mock).mockRejectedValue(
        new Error('DB down'),
      );

      const result = await controller.logout(req, res);

      expect(result).toEqual({ data: { success: true } });
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/auth/methods', () => {
    it('returns googleEnabled=true when settings returns enabled', async () => {
      const settings = (
        controller as unknown as {
          settings: { getGoogleOAuthConfig: jest.Mock };
        }
      ).settings;
      settings.getGoogleOAuthConfig.mockResolvedValueOnce({
        enabled: true,
        clientId: 'x',
        clientSecret: 'y',
      });

      const result = await controller.authMethods();
      expect(result).toEqual({ data: { googleEnabled: true } });
    });

    it('degrades gracefully (googleEnabled=false) when DB is unavailable', async () => {
      const settings = (
        controller as unknown as {
          settings: { getGoogleOAuthConfig: jest.Mock };
        }
      ).settings;
      settings.getGoogleOAuthConfig.mockRejectedValueOnce(
        new Error("Can't reach database server at db:5432"),
      );

      const result = await controller.authMethods();
      expect(result).toEqual({ data: { googleEnabled: false } });
    });
  });
});
