import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { EmailQueueService } from '../email/email-queue.service';
import { PasswordPolicyService } from './password-policy.service';

jest.mock('bcrypt');

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let module: TestingModule;
  let emailQueueService: EmailQueueService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            refreshToken: {
              create: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn(),
              update: jest.fn().mockResolvedValue({}),

              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            loginCode: {
              create: jest.fn().mockResolvedValue({}),
              findFirst: jest.fn().mockResolvedValue(null),
              update: jest.fn().mockResolvedValue({}),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },

            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockImplementation((payload: any) => {

              return `mock_${payload?.type ?? 'plain'}_token`;
            }),
          },
        },
        {
          provide: EmailQueueService,
          useValue: {
            enqueuePasswordReset: jest.fn().mockResolvedValue({ id: 'job-1' }),
            enqueueLoginCode: jest.fn().mockResolvedValue({ id: 'job-2' }),
          },
        },
        {
          provide: PasswordPolicyService,
          useValue: { validate: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    emailQueueService = module.get<EmailQueueService>(EmailQueueService);

    ((prisma as any).$transaction as jest.Mock).mockImplementation(
      async (arg: any) => {
        if (typeof arg === 'function') return arg(prisma);
        if (Array.isArray(arg)) return Promise.all(arg);
        return undefined;
      },
    );
  });

  describe('register', () => {
    const validDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
    };

    it('should create a new user with hashed password and CUSTOMER role', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        email: validDto.email,
        name: validDto.name,
        role: 'CUSTOMER',
        createdAt: new Date(),
      });

      const result = await service.register(validDto);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe(validDto.email);
      expect(result.role).toBe('CUSTOMER');
      expect(bcrypt.hash).toHaveBeenCalledWith(validDto.password, 12);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: validDto.email,
            password: 'hashedpassword',
            role: 'CUSTOMER',
          }),
        }),
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: validDto.email,
      });

      await expect(service.register(validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should NEVER allow role to be set from registration', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        email: validDto.email,
        name: validDto.name,
        role: 'CUSTOMER',
        createdAt: new Date(),
      });

      await service.register({ ...validDto, role: 'ADMIN' } as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'CUSTOMER',
          }),
        }),
      );
    });

    it('should never return the password hash', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        email: validDto.email,
        name: validDto.name,
        role: 'CUSTOMER',
        createdAt: new Date(),
      });

      const result = await service.register(validDto);

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    const mockUser = {
      id: 'cuid1',
      email: loginDto.email,
      name: 'Test User',
      password: 'hashedpassword',
      role: 'CUSTOMER',
      isActive: true,
    };

    it('should return tokens and user data with valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should use generic error message to prevent user enumeration', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      try {
        await service.login(loginDto);
      } catch (e: any) {
        expect(e.message).toBe('Invalid email or password');
      }
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should update lastLoginAt on successful login', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.login(loginDto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('loginOrCreateWithGoogle', () => {
    const baseProfile = {
      googleId: 'sub_12345',
      email: 'user@gmail.com',
      emailVerified: true,
      name: 'Test User',
      picture: 'https://lh3.googleusercontent.com/a/AbCd',
    };

    it('rejects email not verified by Google (anti-impersonation)', async () => {
      await expect(
        service.loginOrCreateWithGoogle({
          ...baseProfile,
          emailVerified: false,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('direct login when googleId is already linked', async () => {
      const existing = {
        id: 'cuid_a',
        email: baseProfile.email,
        name: 'Test User',
        password: 'hashed',
        role: 'CUSTOMER',
        isActive: true,
        googleId: baseProfile.googleId,
        googlePicture: baseProfile.picture,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(existing);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.loginOrCreateWithGoogle(baseProfile);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: baseProfile.googleId },
      });

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user.id).toBe('cuid_a');
      expect(result).toHaveProperty('accessToken');
    });

    it('links googleId in existing user when email matches AND already verified', async () => {
      const localUser = {
        id: 'cuid_b',
        email: baseProfile.email,
        name: 'Local User',
        password: 'hashed',
        role: 'CUSTOMER',
        isActive: true,
        googleId: null,
        googlePicture: null,
        emailVerified: true,
      };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(localUser);
      (prisma.user.update as jest.Mock).mockResolvedValueOnce({
        ...localUser,
        googleId: baseProfile.googleId,
        googlePicture: baseProfile.picture,
      });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.loginOrCreateWithGoogle(baseProfile);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: localUser.id },
          data: expect.objectContaining({
            googleId: baseProfile.googleId,
            googlePicture: baseProfile.picture,
          }),
        }),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user.id).toBe('cuid_b');
    });

    it('REJECTS link when local account has not yet confirmed email (anti pre-hijacking)', async () => {
      const unverifiedLocal = {
        id: 'cuid_pre',
        email: baseProfile.email,
        name: 'Pre-hijack victim',
        password: 'hashed',
        role: 'CUSTOMER',
        isActive: true,
        googleId: null,
        googlePicture: null,
        emailVerified: false,
      };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(unverifiedLocal);

      await expect(
        service.loginOrCreateWithGoogle(baseProfile),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();

      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('race condition case: P2002 on create triggers refetch and success', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'cuid_race',
        email: baseProfile.email,
        password: 'hashed',
        role: 'CUSTOMER',
        isActive: true,
        googleId: baseProfile.googleId,
      });
      const p2002 = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        clientVersion: '6.x',
      });

      Object.setPrototypeOf(
        p2002,
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      (prisma.user.create as jest.Mock).mockRejectedValueOnce(p2002);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_random');
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.loginOrCreateWithGoogle(baseProfile);

      expect(result.user.id).toBe('cuid_race');

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('creates new CUSTOMER when no googleId nor email matches', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      const created = {
        id: 'cuid_new',
        email: baseProfile.email,
        name: baseProfile.name,
        password: 'hashed_random',
        role: 'CUSTOMER',
        isActive: true,
        googleId: baseProfile.googleId,
        googlePicture: baseProfile.picture,
        emailVerified: true,
      };
      (prisma.user.create as jest.Mock).mockResolvedValueOnce(created);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_random');
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.loginOrCreateWithGoogle(baseProfile);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: baseProfile.email,
            googleId: baseProfile.googleId,
            role: 'CUSTOMER',
            emailVerified: true,
            password: 'hashed_random',
          }),
        }),
      );

      expect(bcrypt.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{64}$/),
        expect.any(Number),
      );
      expect(result.user.id).toBe('cuid_new');
    });

    it('rejects inactive user (isActive=false)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'cuid_x',
        email: baseProfile.email,
        password: 'hashed',
        role: 'CUSTOMER',
        isActive: false,
        googleId: baseProfile.googleId,
        googlePicture: baseProfile.picture,
      });

      await expect(
        service.loginOrCreateWithGoogle(baseProfile),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('updates googlePicture when Google sends a new avatar', async () => {
      const existing = {
        id: 'cuid_p',
        email: baseProfile.email,
        password: 'hashed',
        role: 'CUSTOMER',
        isActive: true,
        googleId: baseProfile.googleId,
        googlePicture: 'https://old-pic.com/x',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(existing);
      (prisma.user.update as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ ...existing, ...data }),
      );
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      await service.loginOrCreateWithGoogle(baseProfile);

      const updateCalls = (prisma.user.update as jest.Mock).mock.calls;
      const pictureUpdate = updateCalls.find(
        (c: any[]) => c[0]?.data?.googlePicture === baseProfile.picture,
      );
      expect(pictureUpdate).toBeDefined();
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens with valid refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'cuid1',
        familyId: 'fam1',
        token: 'valid_token',
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        user: { isActive: true },
      });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.refreshToken('valid_token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should mark old token as revoked (atomic updateMany) and create new one', async () => {

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'cuid1',
        familyId: 'fam1',
        token: sha256('old_token'),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        user: { isActive: true },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValueOnce({
        count: 1,
      });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      await service.refreshToken('old_token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt1', revokedAt: null },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalled();

      expect(prisma.refreshToken.delete).not.toHaveBeenCalled();
    });

    it('concurrent reuse (updateMany count=0): wipe FAMILY strictly', async () => {

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-race',
        userId: 'cuid1',
        familyId: 'fam-compromised',
        token: sha256('racy_token'),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        user: { isActive: true },
      });
      (prisma.refreshToken.updateMany as jest.Mock)
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 3 });

      await expect(service.refreshToken('racy_token')).rejects.toThrow(
        UnauthorizedException,
      );

      const calls = (prisma.refreshToken.updateMany as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[1][0]).toMatchObject({
        where: { familyId: 'fam-compromised', revokedAt: null },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should throw for expired refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'cuid1',
        familyId: 'fam1',
        token: 'expired_token',
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        user: { isActive: true },
      });

      await expect(service.refreshToken('expired_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw for invalid (non-existent) refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.refreshToken('invalid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw for revoked refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'cuid1',
        familyId: 'fam1',
        token: sha256('revoked_token'),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(),
        user: { isActive: true },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await expect(service.refreshToken('revoked_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken — structured error codes', () => {
    function getErrorBody(err: any): any {

      return typeof err.getResponse === 'function' ? err.getResponse() : null;
    }

    it('grace period direct (revokedAt < 5s ago): errorCode=TOKEN_ROTATED', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-graced',
        userId: 'u1',
        familyId: 'fam-graced',
        token: sha256('graced_token'),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 1_000),
        user: { isActive: true },
      });

      try {
        await service.refreshToken('graced_token');
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(getErrorBody(err)?.errorCode).toBe('TOKEN_ROTATED');
      }

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ familyId: 'fam-graced' }),
        }),
      );
    });

    it('reuse real (revokedAt > 5s): errorCode=TOKEN_REUSE + wipe family', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-stolen',
        userId: 'u1',
        familyId: 'fam-stolen',
        token: sha256('stolen_token'),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 60_000),
        user: { isActive: true },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      try {
        await service.refreshToken('stolen_token');
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(getErrorBody(err)?.errorCode).toBe('TOKEN_REUSE');
      }
    });

    it('rotation count=0 inside the grace: errorCode=TOKEN_ROTATED', async () => {

      const recentRevoke = new Date(Date.now() - 500);
      (prisma.refreshToken.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'rt-race',
          userId: 'u1',
          familyId: 'fam-race',
          token: sha256('racy'),
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          revokedAt: null,
          user: { isActive: true },
        })

        .mockResolvedValueOnce({
          id: 'rt-race',
          revokedAt: recentRevoke,
        });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValueOnce({
        count: 0,
      });

      try {
        await service.refreshToken('racy');
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(getErrorBody(err)?.errorCode).toBe('TOKEN_ROTATED');
      }

      const wipeCalls = (
        prisma.refreshToken.updateMany as jest.Mock
      ).mock.calls.filter((c) => c[0]?.where?.familyId === 'fam-race');
      expect(wipeCalls.length).toBe(0);
    });

    it('rotation count=0 beyond the grace: errorCode=TOKEN_REUSE', async () => {
      const oldRevoke = new Date(Date.now() - 60_000);
      (prisma.refreshToken.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'rt-reuse',
          userId: 'u1',
          familyId: 'fam-reuse',
          token: sha256('reuse'),
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          revokedAt: null,
          user: { isActive: true },
        })
        .mockResolvedValueOnce({
          id: 'rt-reuse',
          revokedAt: oldRevoke,
        });
      (prisma.refreshToken.updateMany as jest.Mock)
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 5 });

      try {
        await service.refreshToken('reuse');
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(getErrorBody(err)?.errorCode).toBe('TOKEN_REUSE');
      }
    });

    it('expired: errorCode=TOKEN_EXPIRED', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-exp',
        userId: 'u1',
        familyId: 'fam-exp',
        token: sha256('expired'),
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        user: { isActive: true },
      });

      try {
        await service.refreshToken('expired');
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(getErrorBody(err)?.errorCode).toBe('TOKEN_EXPIRED');
      }
    });

    it('non-existent token: errorCode=TOKEN_INVALID', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      try {
        await service.refreshToken('ghost');
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(getErrorBody(err)?.errorCode).toBe('TOKEN_INVALID');
      }
    });

    it('user banned: errorCode=TOKEN_INVALID + wipe family', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-banned',
        userId: 'u-banned',
        familyId: 'fam-banned',
        token: sha256('banned'),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        user: { isActive: false },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      try {
        await service.refreshToken('banned');
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(getErrorBody(err)?.errorCode).toBe('TOKEN_INVALID');
      }
    });
  });

  describe('rememberMe / persistent flag', () => {
    const realUser = {
      id: 'u-rm',
      email: 'rm@x.com',
      name: 'RM',
      password: 'hash',
      role: 'CUSTOMER',
      isActive: true,
      passwordSet: true,
    };

    function findCreatedRefreshToken(): any {
      const calls = (prisma.refreshToken.create as jest.Mock).mock.calls;
      return calls[calls.length - 1]?.[0]?.data;
    }

    it('login(rememberMe=true): DB persistent=true + expiresAt ~30d', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.login({
        email: 'rm@x.com',
        password: 'x',
        rememberMe: true,
      });

      const data = findCreatedRefreshToken();
      expect(data.persistent).toBe(true);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
      expect(ttl).toBeLessThan(31 * 24 * 60 * 60 * 1000);
      expect(result.persistent).toBe(true);
    });

    it('login(rememberMe=false): DB persistent=false + expiresAt ~1d', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.login({
        email: 'rm@x.com',
        password: 'x',
        rememberMe: false,
      });

      const data = findCreatedRefreshToken();
      expect(data.persistent).toBe(false);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ttl).toBeLessThan(25 * 60 * 60 * 1000);
      expect(result.persistent).toBe(false);
    });

    it('login() without explicit rememberMe (legacy client): default fail-safe = persistent=false (1d)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.login({ email: 'rm@x.com', password: 'x' });

      const data = findCreatedRefreshToken();
      expect(data.persistent).toBe(false);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('verifyLoginCode(rememberMe=true): persistent=true + 30d', async () => {
      const pepper = process.env.OTP_PEPPER ?? 'dev-only-pepper';
      const codeHash = crypto
        .createHmac('sha256', pepper)
        .update('123456')
        .digest('hex');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (prisma.loginCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'lc-rm',
        userId: 'u-rm',
        codeHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        usedAt: null,
        attempts: 0,
        purpose: 'LOGIN',
      });
      (prisma.loginCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.verifyLoginCode('rm@x.com', '123456', true);

      const data = findCreatedRefreshToken();
      expect(data.persistent).toBe(true);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    });

    it('verifyLoginCode(rememberMe=false): persistent=false + 1d', async () => {
      const pepper = process.env.OTP_PEPPER ?? 'dev-only-pepper';
      const codeHash = crypto
        .createHmac('sha256', pepper)
        .update('123456')
        .digest('hex');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (prisma.loginCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'lc-rm',
        userId: 'u-rm',
        codeHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        usedAt: null,
        attempts: 0,
        purpose: 'LOGIN',
      });
      (prisma.loginCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.verifyLoginCode('rm@x.com', '123456', false);

      const data = findCreatedRefreshToken();
      expect(data.persistent).toBe(false);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('loginOrCreateForGuest: ALWAYS persistent=false (one-shot purchase)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'u-guest',
        email: 'g@x.com',
        role: 'CUSTOMER',
        isActive: true,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.loginOrCreateForGuest({
        email: 'g@x.com',
      });

      const data = findCreatedRefreshToken();
      expect(data.persistent).toBe(false);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeLessThan(25 * 60 * 60 * 1000);
      expect(result.persistent).toBe(false);
    });

    it('loginOrCreateWithGoogle: ALWAYS persistent=true (no checkbox in flow)', async () => {
      const googleUser = {
        id: 'u-g',
        email: 'g@x.com',
        role: 'CUSTOMER',
        isActive: true,
        googleId: 'sub_x',

        googlePicture: null,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(googleUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(googleUser);

      const result = await service.loginOrCreateWithGoogle({
        googleId: 'sub_x',
        email: 'g@x.com',
        emailVerified: true,
        name: 'G',
        picture: null,
      });

      const data = findCreatedRefreshToken();
      expect(data.persistent).toBe(true);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
      expect(result.persistent).toBe(true);
    });

    it('refresh herda persistent=true from family (rotation maintains regime)', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-p',
        userId: 'u1',
        familyId: 'fam-p',
        token: sha256('persistent_token'),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        persistent: true,
        user: { isActive: true },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.refreshToken('persistent_token');

      const data = findCreatedRefreshToken();
      expect(data.persistent).toBe(true);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
      expect(result.persistent).toBe(true);
    });

    it('refresh herda persistent=false from family (attacker does not promote)', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-np',
        userId: 'u1',
        familyId: 'fam-np',
        token: sha256('session_token'),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        revokedAt: null,
        persistent: false,
        user: { isActive: true },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.refreshToken('session_token');

      const data = findCreatedRefreshToken();
      expect(data.persistent).toBe(false);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeLessThan(25 * 60 * 60 * 1000);
      expect(result.persistent).toBe(false);
    });
  });

  describe('JWT payload hardening', () => {
    it('access token payload includes type="access"', async () => {
      const jwtService = module.get<JwtService>(JwtService);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'X',
        password: 'hash',
        role: 'CUSTOMER',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.login({ email: 'a@b.com', password: 'x' });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u1', type: 'access' }),
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
    });

    it('refresh token payload includes type="refresh"', async () => {
      const jwtService = module.get<JwtService>(JwtService);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'X',
        password: 'hash',
        role: 'CUSTOMER',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.login({ email: 'a@b.com', password: 'x' });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u1', type: 'refresh' }),
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
    });
  });

  describe('Access token TTL', () => {
    it('access token expiresIn is 1h (short-lived)', async () => {
      const jwtService = module.get<JwtService>(JwtService);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'X',
        password: 'hash',
        role: 'CUSTOMER',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.login({ email: 'a@b.com', password: 'x' });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access' }),
        { expiresIn: '1h' },
      );
    });

    it('refresh token expiresIn is 30d when rememberMe=true (long-lived, replacement-on-rotation)', async () => {
      const jwtService = module.get<JwtService>(JwtService);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'X',
        password: 'hash',
        role: 'CUSTOMER',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.login({
        email: 'a@b.com',
        password: 'x',
        rememberMe: true,
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        { expiresIn: '30d' },
      );
    });
  });

  describe('Refresh token SHA256 at rest', () => {
    it('login: persists SHA256 of refresh token, never the raw value', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'X',
        password: 'hash',
        role: 'CUSTOMER',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.login({ email: 'a@b.com', password: 'x' });

      const expectedHash = sha256('mock_refresh_token');
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: expectedHash,
          userId: 'u1',
        }),
      });

      expect(result.refreshToken).toBe('mock_refresh_token');
      expect(result.refreshToken).not.toBe(expectedHash);
    });

    it('refreshToken: looks up by SHA256 of received token, not by raw', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        familyId: 'fam1',
        token: sha256('client_has_raw_token'),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        revokedAt: null,
        user: { isActive: true },
      });
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      await service.refreshToken('client_has_raw_token');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: sha256('client_has_raw_token') },
        }),
      );
    });
  });

  describe('Login timing-attack mitigation', () => {

    it('runs bcrypt.compare even when user does not exist (constant time)', async () => {

      (bcrypt.compare as jest.Mock).mockClear();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      try {
        await service.login({ email: 'ghost@test.com', password: 'x' });
      } catch {

      }

      expect(bcrypt.compare).toHaveBeenCalled();
    });
  });

  describe('Refresh rotation atomicity', () => {
    it('revoke old and create new run in $transaction', async () => {
      const txSpy = jest.fn().mockImplementation(async (cb: any) => cb(prisma));
      (prisma as any).$transaction = txSpy;

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        familyId: 'fam1',
        token: sha256('valid'),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        revokedAt: null,
        user: { isActive: true },
      });
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      await service.refreshToken('valid');

      expect(txSpy).toHaveBeenCalled();
    });
  });

  describe('Reuse detection (RFC 6819)', () => {
    it('presenting already revoked token (after grace) revokes only the FAMILY', async () => {

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-stolen',
        userId: 'u1',
        familyId: 'fam-stolen',
        token: sha256('stolen_token'),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 60_000),
        user: { isActive: true },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await expect(service.refreshToken('stolen_token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam-stolen', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });

      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('expired token DOES NOT trigger chain revocation (expiry != reuse)', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-old',
        userId: 'u1',
        familyId: 'fam-old',
        token: sha256('expired_token'),
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        user: { isActive: true },
      });

      await expect(service.refreshToken('expired_token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token and send email for existing user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        email: 'test@example.com',
        name: 'Test',
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const emailQueueService =
        module.get<EmailQueueService>(EmailQueueService);

      await service.forgotPassword('test@example.com');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cuid1' },
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        }),
      );
      expect(emailQueueService.enqueuePasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          name: 'Test',
          resetUrl: expect.stringContaining('reset-password'),
        }),
      );
    });

    it('should NOT throw for non-existent email (prevent enumeration)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.forgotPassword('nonexistent@example.com'),
      ).resolves.not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        passwordResetToken: 'valid_token',
        passwordResetExpires: new Date(Date.now() + 3600000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhashed');
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.resetPassword('valid_token', 'NewPass123!');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'cuid1' },
        data: {
          password: 'newhashed',
          passwordResetToken: null,
          passwordResetExpires: null,
          passwordSet: true,
          emailVerified: true,
        },
      });
    });

    it('should throw for invalid token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid_token', 'NewPass123!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for expired token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        passwordResetToken: 'expired_token',
        passwordResetExpires: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword('expired_token', 'NewPass123!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('revokes ALL refresh tokens from user (anti pre-hijack)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid_victim',
        email: 'v@x.com',
        role: 'CUSTOMER',
        passwordResetToken: 'tok',
        passwordResetExpires: new Date(Date.now() + 60_000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');

      await service.resetPassword('tok', 'NewSecurePassword123!');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'cuid_victim', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should mark passwordSet=true + emailVerified=true after reset (shadow claim)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid_shadow',
        email: 't@x.com',
        role: 'CUSTOMER',
        passwordSet: false,
        emailVerified: false,
        passwordResetToken: 'tok',
        passwordResetExpires: new Date(Date.now() + 60_000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');

      await service.resetPassword('tok', 'NewPassword123!');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cuid_shadow' },
          data: expect.objectContaining({
            passwordSet: true,
            emailVerified: true,
          }),
        }),
      );
    });
  });

  describe('identify', () => {
    it('real user (passwordSet=true) → exists=true', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        passwordSet: true,
        googleId: null,
      });
      const r = await service.identify('user@x.com');
      expect(r).toEqual({ exists: true, hasPassword: true, hasGoogle: false });
    });

    it('user with googleId → exists=true', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        passwordSet: false,
        googleId: 'g123',
      });
      const r = await service.identify('user@x.com');
      expect(r).toEqual({ exists: true, hasPassword: false, hasGoogle: true });
    });

    it('shadow user (passwordSet=false + googleId=null) → exists=FALSE (anti-enum)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        passwordSet: false,
        googleId: null,
      });
      const r = await service.identify('user@x.com');
      expect(r.exists).toBe(false);
    });

    it('non-existent user → exists=false', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const r = await service.identify('user@x.com');
      expect(r.exists).toBe(false);
    });
  });

  describe('requestLoginCode', () => {
    const realUser = {
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      isActive: true,
    };

    it('creates record with sha256 codeHash + expires in 10min', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);

      await service.requestLoginCode('a@b.com');

      const createCall = (prisma.loginCode.create as jest.Mock).mock
        .calls[0]?.[0];
      expect(createCall.data.userId).toBe('u1');
      expect(createCall.data.codeHash).toMatch(/^[a-f0-9]{64}$/);
      expect(createCall.data.purpose).toBe('LOGIN');
      const expiresIn = createCall.data.expiresAt.getTime() - Date.now();
      expect(expiresIn).toBeGreaterThan(9 * 60 * 1000);
      expect(expiresIn).toBeLessThan(11 * 60 * 1000);
    });

    it('enqueueLoginCode with plaintext code', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);

      await service.requestLoginCode('a@b.com');

      expect(emailQueueService.enqueueLoginCode).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@b.com',
          name: 'Alice',
          code: expect.stringMatching(/^\d{6}$/),
          purpose: 'LOGIN',
        }),
      );
    });

    it('nonexistent user → silent success (does not create code, does not enqueue)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.requestLoginCode('ghost@x.com'),
      ).resolves.toBeUndefined();
      expect(prisma.loginCode.create).not.toHaveBeenCalled();
      expect(emailQueueService.enqueueLoginCode).not.toHaveBeenCalled();
    });

    it('lockout: skip create if there is a code with >= MAX_ATTEMPTS in the last 15min', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (prisma.loginCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'locked',
        attempts: 5,
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      });

      await service.requestLoginCode('a@b.com');

      expect(prisma.loginCode.create).not.toHaveBeenCalled();
      expect(emailQueueService.enqueueLoginCode).not.toHaveBeenCalled();
    });

    it('PURPOSE CLAIM is propagated to create + email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);

      await service.requestLoginCode('a@b.com', 'CLAIM');

      expect(
        (prisma.loginCode.create as jest.Mock).mock.calls[0][0].data.purpose,
      ).toBe('CLAIM');
      expect(emailQueueService.enqueueLoginCode).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'CLAIM' }),
      );
    });

    it('invalidate pending codes before creating new one (anti-flooding)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);

      await service.requestLoginCode('a@b.com');

      expect(prisma.loginCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'u1',
            usedAt: null,
            expiresAt: { gt: expect.any(Date) },
          }),
          data: { expiresAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('verifyLoginCode', () => {
    const realUser = {
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      role: 'CUSTOMER',
      isActive: true,
    };

    function mockValidCode(code: string, overrides: Record<string, any> = {}) {

      const pepper = process.env.OTP_PEPPER ?? 'dev-only-pepper';
      const codeHash = crypto
        .createHmac('sha256', pepper)
        .update(code)
        .digest('hex');
      return {
        id: 'lc1',
        userId: 'u1',
        codeHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        usedAt: null,
        attempts: 0,
        purpose: 'LOGIN',
        ...overrides,
      };
    }

    it('happy path: correct code → tokens + emailVerified=true + usedAt set', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (prisma.loginCode.findFirst as jest.Mock).mockResolvedValue(
        mockValidCode('123456'),
      );

      (prisma.loginCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.verifyLoginCode('a@b.com', '123456');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe('u1');

      expect(prisma.loginCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lc1', usedAt: null },
          data: { usedAt: expect.any(Date) },
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emailVerified: true }),
        }),
      );
    });

    it('atomic mark-as-used count=0 (race) → throw "already used"', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (prisma.loginCode.findFirst as jest.Mock).mockResolvedValue(
        mockValidCode('123456'),
      );

      (prisma.loginCode.updateMany as jest.Mock)
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(
        service.verifyLoginCode('a@b.com', '123456'),
      ).rejects.toThrow(/already used/i);
    });

    it('nonexistent user → generic UnauthorizedException', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.verifyLoginCode('ghost@x.com', '111111'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('code expired → findFirst filters (expiresAt: gt now), throw', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);

      (prisma.loginCode.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.verifyLoginCode('a@b.com', '111111'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('code wrong → atomic increment via updateMany, throw', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (prisma.loginCode.findFirst as jest.Mock).mockResolvedValue(
        mockValidCode('111111', { attempts: 2 }),
      );

      (prisma.loginCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await expect(
        service.verifyLoginCode('a@b.com', '999999'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.loginCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attempts: { lt: 5 },
          }),
          data: { attempts: { increment: 1 } },
        }),
      );
    });

    it('updateMany count=0 (attempts already >= MAX) → throw blocked, does not compare', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);
      (prisma.loginCode.findFirst as jest.Mock).mockResolvedValue(
        mockValidCode('111111', { attempts: 5 }),
      );

      (prisma.loginCode.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await expect(
        service.verifyLoginCode('a@b.com', '111111'),
      ).rejects.toThrow(/blocked|attempts/i);

      expect(prisma.loginCode.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { usedAt: expect.any(Date) } }),
      );
    });

    it('code already used (usedAt set) → findFirst returns null → throw', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(realUser);

      (prisma.loginCode.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.verifyLoginCode('a@b.com', '111111'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginOrCreateForGuest', () => {
    const profile = {
      email: 'guest@x.com',
      marketingConsent: false,
    };

    it('user real (passwordSet=true) → ConflictException', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u_real',
        email: profile.email,
        passwordSet: true,
        googleId: null,
        isActive: true,
      });

      await expect(service.loginOrCreateForGuest(profile)).rejects.toThrow(
        ConflictException,
      );
    });

    it('user real (googleId set) → ConflictException', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u_g',
        email: profile.email,
        passwordSet: false,
        googleId: 'g123',
        isActive: true,
      });

      await expect(service.loginOrCreateForGuest(profile)).rejects.toThrow(
        ConflictException,
      );
    });

    it('existing shadow → reuse, no PII (CCCD/name/phone)', async () => {
      const shadow = {
        id: 'u_shadow',
        email: profile.email,
        name: 'Jane Doe',
        cccd: '001100000001',
        phone: '0901234567',
        passwordSet: false,
        googleId: null,
        isActive: true,
        marketingConsent: false,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(shadow);
      (prisma.user.update as jest.Mock).mockResolvedValue(shadow);

      const result = await service.loginOrCreateForGuest({
        email: profile.email,
        marketingConsent: true,
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u_shadow' },
          data: { marketingConsent: true },
        }),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user.id).toBe('u_shadow');
      expect(result.isShadow).toBe(true);
    });

    it('existing shadow with marketingConsent=true maintains true if request sends false', async () => {
      const shadow = {
        id: 'u_shadow',
        email: profile.email,
        passwordSet: false,
        googleId: null,
        isActive: true,
        marketingConsent: true,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(shadow);
      (prisma.user.update as jest.Mock).mockResolvedValue(shadow);

      await service.loginOrCreateForGuest({
        email: profile.email,
        marketingConsent: false,
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { marketingConsent: true },
        }),
      );
    });

    it('new user → creates with passwordSet=false + random hex password + no PII', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'u_new',
        email: profile.email,
        password: 'hashed',
        passwordSet: false,
        role: 'CUSTOMER',
        isActive: true,
      });

      const result = await service.loginOrCreateForGuest(profile);

      const createCall = (prisma.user.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        email: profile.email,
        passwordSet: false,
        role: 'CUSTOMER',
        emailVerified: false,
        marketingConsent: false,
      });

      expect(createCall.data).not.toHaveProperty('cccd');
      expect(createCall.data).not.toHaveProperty('name');
      expect(createCall.data).not.toHaveProperty('phone');
      expect(bcrypt.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{64}$/),
        expect.any(Number),
      );
      expect(result.user.id).toBe('u_new');
    });

    it('P2002 race: refetch shadow → reuse', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'u_race_shadow',
          email: profile.email,
          passwordSet: false,
          googleId: null,
          isActive: true,
        });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const p2002 = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
        clientVersion: '6.x',
      });
      Object.setPrototypeOf(
        p2002,
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      (prisma.user.create as jest.Mock).mockRejectedValueOnce(p2002);

      const result = await service.loginOrCreateForGuest(profile);

      expect(result.user.id).toBe('u_race_shadow');
    });

    it('P2002 race: refetch finds real user → ConflictException', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'u_race_real',
          email: profile.email,
          passwordSet: true,
          googleId: null,
          isActive: true,
        });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const p2002 = Object.assign(new Error('Unique'), {
        code: 'P2002',
        clientVersion: '6.x',
      });
      Object.setPrototypeOf(
        p2002,
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      (prisma.user.create as jest.Mock).mockRejectedValueOnce(p2002);

      await expect(service.loginOrCreateForGuest(profile)).rejects.toThrow(
        ConflictException,
      );
    });

    it('emits tokens with new familyId (anti session-fixation)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'u_new',
        email: profile.email,
        role: 'CUSTOMER',
        isActive: true,
      });

      const result = await service.loginOrCreateForGuest(profile);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyId: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('revokeRefreshTokenFamily (logout)', () => {
    it('revokes entire family when token is valid', async () => {
      const record = {
        id: 'rt1',
        userId: 'u1',
        familyId: 'fam1',
        revokedAt: null,
      };
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(record);
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.revokeRefreshTokenFamily('raw_token');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: sha256('raw_token') },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('silent no-op when token does not exist (idempotent logout)', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.revokeRefreshTokenFamily('ghost_token'),
      ).resolves.toBeUndefined();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
