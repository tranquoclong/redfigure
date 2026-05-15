import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../email/email-queue.service';
import { RegisterDto } from './dto/register.dto';
import { PasswordPolicyService } from './password-policy.service';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import {
  randomBytes,
  randomInt,
  randomUUID,
  createHash,
  createHmac,
  timingSafeEqual,
} from 'crypto';

const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

const ACCESS_TOKEN_EXPIRES = '1h';

const PERSISTENT_REFRESH_EXPIRES = '30d';
const PERSISTENT_REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_EXPIRES = '1d';
const SESSION_REFRESH_EXPIRES_MS = 24 * 60 * 60 * 1000;

const REFRESH_REUSE_GRACE_MS = 5_000;

const LOGIN_CODE_EXPIRES_MS = 10 * 60 * 1000;
const LOGIN_CODE_MAX_ATTEMPTS = 5;
const LOGIN_CODE_LOCKOUT_MS = 15 * 60 * 1000;

const LOGIN_CODE_PADDING_MS = 250;

const LOGIN_CODE_COOLDOWN_MS = 30_000;

function hashLoginCode(code: string): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL: OTP_PEPPER not set in production — set env var (>=32 chars) before starting app',
      );
    }

    return createHmac('sha256', 'dev-only-pepper').update(code).digest('hex');
  }
  return createHmac('sha256', pepper).update(code).digest('hex');
}

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy_placeholder', SALT_ROUNDS);

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailQueueService: EmailQueueService,
    private passwordPolicy: PasswordPolicyService,
  ) { }

  async register(dto: RegisterDto) {

    await this.passwordPolicy.validate(dto.password, 'CUSTOMER');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: 'CUSTOMER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async login(dto: { email: string; password: string; rememberMe?: boolean }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const hashToCompare = user?.password || DUMMY_PASSWORD_HASH;
    const passwordMatch = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !user.isActive || !user.password || !passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const persistent = dto.rememberMe === true;
    const tokens = this.generateTokens(user.id, persistent);

    await this.prisma.refreshToken.create({
      data: {
        token: hashToken(tokens.refreshToken),
        userId: user.id,
        familyId: randomUUID(),
        expiresAt: this.refreshExpiresAt(persistent),
        persistent,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      persistent,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async loginOrCreateWithGoogle(profile: {
    googleId: string;
    email: string;
    emailVerified: boolean;
    name: string | null;
    picture: string | null;
  }) {
    if (!profile.emailVerified) {

      throw new UnauthorizedException('Email not verified by Google');
    }

    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (!user) {

      const byEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (byEmail) {
        if (!byEmail.emailVerified) {

          throw new UnauthorizedException(
            'Existing account with this email has not confirmed registration. ' +
            'Confirm your email first to link.',
          );
        }
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: profile.googleId,
            googlePicture: profile.picture,
          },
        });
      } else {

        const randomPassword = randomBytes(32).toString('hex');
        const hashed = await bcrypt.hash(randomPassword, SALT_ROUNDS);
        try {
          user = await this.prisma.user.create({
            data: {
              email: profile.email,
              name: profile.name,
              password: hashed,
              role: 'CUSTOMER',
              emailVerified: true,
              googleId: profile.googleId,
              googlePicture: profile.picture,
            },
          });
        } catch (err) {

          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {

            const refetch = await this.prisma.user.findFirst({
              where: {
                OR: [{ googleId: profile.googleId }, { email: profile.email }],
              },
            });
            if (refetch?.googleId === profile.googleId) {

              user = refetch;
            } else {

              throw new UnauthorizedException(
                'Conflict creating account — try again in a moment.',
              );
            }
          } else {
            throw err;
          }
        }
      }
    } else if (user.googlePicture !== profile.picture) {

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googlePicture: profile.picture },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Inactive account');
    }

    const persistent = true;
    const tokens = this.generateTokens(user.id, persistent);
    await this.prisma.refreshToken.create({
      data: {
        token: hashToken(tokens.refreshToken),
        userId: user.id,
        familyId: randomUUID(),
        expiresAt: this.refreshExpiresAt(persistent),
        persistent,
      },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      persistent,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshToken(token: string) {

    const tokenHash = hashToken(token);
    const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: { select: { isActive: true } } },
    });

    if (!refreshTokenRecord) {
      throw new UnauthorizedException({
        message: 'Invalid or expired refresh token',
        errorCode: 'TOKEN_INVALID',
      });
    }

    if (!refreshTokenRecord.user || !refreshTokenRecord.user.isActive) {

      await this.prisma.refreshToken.updateMany({
        where: {
          familyId: refreshTokenRecord.familyId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh rejected: user ${refreshTokenRecord.userId} inactive/banned. Family ${refreshTokenRecord.familyId} revoked.`,
      );
      throw new UnauthorizedException({
        message: 'Invalid or expired refresh token',
        errorCode: 'TOKEN_INVALID',
      });
    }

    if (refreshTokenRecord.revokedAt) {
      if (!this.isWithinGracePeriod(refreshTokenRecord.revokedAt)) {
        await this.prisma.refreshToken.updateMany({
          where: {
            familyId: refreshTokenRecord.familyId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        this.logger.warn(
          `SECURITY: refresh token reuse detected — user=${refreshTokenRecord.userId} family=${refreshTokenRecord.familyId} wiped`,
        );
        throw new UnauthorizedException({
          message: 'Token reuse detected — session family revoked',
          errorCode: 'TOKEN_REUSE',
        });
      }

      throw new UnauthorizedException({
        message: 'Token already rotated',
        errorCode: 'TOKEN_ROTATED',
      });
    }

    if (refreshTokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException({
        message: 'Invalid or expired refresh token',
        errorCode: 'TOKEN_EXPIRED',
      });
    }

    const persistent = refreshTokenRecord.persistent;
    const tokens = this.generateTokens(refreshTokenRecord.userId, persistent);

    const txResult = await this.prisma.$transaction(async (tx) => {
      const revokeResult = await tx.refreshToken.updateMany({
        where: { id: refreshTokenRecord.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revokeResult.count === 0) {
        const latest = await tx.refreshToken.findUnique({
          where: { id: refreshTokenRecord.id },
        });
        if (this.isWithinGracePeriod(latest?.revokedAt ?? null)) {
          return { status: 'grace' as const };
        }

        await tx.refreshToken.updateMany({
          where: {
            familyId: refreshTokenRecord.familyId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        return { status: 'reuse' as const };
      }
      await tx.refreshToken.create({
        data: {
          token: hashToken(tokens.refreshToken),
          userId: refreshTokenRecord.userId,
          familyId: refreshTokenRecord.familyId,
          expiresAt: this.refreshExpiresAt(persistent),
          persistent,
        },
      });
      return { status: 'ok' as const };
    });

    if (txResult.status === 'grace') {
      throw new UnauthorizedException({
        message: 'Token already rotated',
        errorCode: 'TOKEN_ROTATED',
      });
    }
    if (txResult.status === 'reuse') {
      this.logger.warn(
        `SECURITY: concurrent refresh token reuse — user=${refreshTokenRecord.userId} family=${refreshTokenRecord.familyId} wiped`,
      );
      throw new UnauthorizedException({
        message: 'Concurrent token reuse detected',
        errorCode: 'TOKEN_REUSE',
      });
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      persistent,
    };
  }

  async revokeRefreshTokenFamily(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });
    if (!record) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(
      `Logout: family ${record.familyId} (user ${record.userId}) revoked`,
    );
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return;

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/reset-password?token=${token}`;

    await this.emailQueueService.enqueuePasswordReset({
      to: user.email,
      name: user.name ?? 'Client',
      resetUrl,
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.passwordPolicy.validate(
      newPassword,
      user.role as 'ADMIN' | 'CUSTOMER',
    );

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,

          passwordSet: true,
          emailVerified: true,
        },
      }),

      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async identify(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { passwordSet: true, googleId: true },
    });
    const exists = Boolean(user && (user.passwordSet || user.googleId));
    return {
      exists,
      hasPassword: exists && Boolean(user?.passwordSet),
      hasGoogle: exists && Boolean(user?.googleId),
    };
  }

  async requestLoginCode(
    email: string,
    purpose: 'LOGIN' | 'CLAIM' = 'LOGIN',
  ): Promise<void> {

    const minDelay = new Promise<void>((r) =>
      setTimeout(r, LOGIN_CODE_PADDING_MS),
    );

    const work = async () => {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) return;

      const recentLocked = await this.prisma.loginCode.findFirst({
        where: {
          userId: user.id,
          attempts: { gte: LOGIN_CODE_MAX_ATTEMPTS },
          createdAt: { gte: new Date(Date.now() - LOGIN_CODE_LOCKOUT_MS) },
        },
      });

      if (recentLocked) {
        this.logger.warn(
          `requestLoginCode: locked out (${LOGIN_CODE_MAX_ATTEMPTS}+ failed) user=${user.id}`,
        );
        return;
      }

      const recentRequest = await this.prisma.loginCode.findFirst({
        where: {
          userId: user.id,
          createdAt: { gt: new Date(Date.now() - LOGIN_CODE_COOLDOWN_MS) },
        },
      });
      if (recentRequest) {
        return;
      }

      await this.prisma.loginCode.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { expiresAt: new Date() },
      });

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const codeHash = hashLoginCode(code);
      const expiresAt = new Date(Date.now() + LOGIN_CODE_EXPIRES_MS);

      await this.prisma.loginCode.create({
        data: { userId: user.id, codeHash, expiresAt, purpose },
      });

      await this.emailQueueService.enqueueLoginCode({
        to: user.email,
        name: user.name ?? 'Client',
        code,
        purpose,
      });
    };

    await Promise.all([work(), minDelay]);
  }

  async verifyLoginCode(email: string, code: string, rememberMe = false) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const loginCode = await this.prisma.loginCode.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!loginCode) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const incrementResult = await this.prisma.loginCode.updateMany({
      where: {
        id: loginCode.id,
        attempts: { lt: LOGIN_CODE_MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    if (incrementResult.count === 0) {
      throw new UnauthorizedException(
        'Code blocked due to excessive attempts',
      );
    }

    const codeHash = hashLoginCode(code);
    const match =
      codeHash.length === loginCode.codeHash.length &&
      timingSafeEqual(
        Buffer.from(codeHash, 'utf8'),
        Buffer.from(loginCode.codeHash, 'utf8'),
      );

    if (!match) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const useResult = await this.prisma.loginCode.updateMany({
      where: { id: loginCode.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (useResult.count === 0) {
      throw new UnauthorizedException('Code already used');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, lastLoginAt: new Date() },
    });

    const persistent = rememberMe === true;
    const tokens = this.generateTokens(user.id, persistent);
    await this.prisma.refreshToken.create({
      data: {
        token: hashToken(tokens.refreshToken),
        userId: user.id,
        familyId: randomUUID(),
        expiresAt: this.refreshExpiresAt(persistent),
        persistent,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      persistent,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async loginOrCreateForGuest(profile: {
    email: string;
    marketingConsent?: boolean;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      if (user.passwordSet || user.googleId) {
        throw new ConflictException(
          'You already have an account with this email. Please login with your password or request a code by email.',
        );
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          marketingConsent: profile.marketingConsent || user.marketingConsent,
        },
      });
    } else {
      const randomPassword = randomBytes(32).toString('hex');
      const hashed = await bcrypt.hash(randomPassword, SALT_ROUNDS);
      try {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            password: hashed,
            passwordSet: false,
            role: 'CUSTOMER',
            emailVerified: false,
            marketingConsent: profile.marketingConsent ?? false,
          },
        });
      } catch (err) {

        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          const refetch = await this.prisma.user.findUnique({
            where: { email: profile.email },
          });
          if (refetch && !refetch.passwordSet && !refetch.googleId) {
            user = refetch;
          } else {
            throw new ConflictException(
              'Conflict creating account — try again in a moment.',
            );
          }
        } else {
          throw err;
        }
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Inactive account');
    }

    const persistent = false;
    const tokens = this.generateTokens(user.id, persistent);
    await this.prisma.refreshToken.create({
      data: {
        token: hashToken(tokens.refreshToken),
        userId: user.id,
        familyId: randomUUID(),
        expiresAt: this.refreshExpiresAt(persistent),
        persistent,
      },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      persistent,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      isShadow: true,
    };
  }

  private isWithinGracePeriod(revokedAt: Date | null): boolean {
    if (!revokedAt) return false;

    const msSinceRevoke = Math.max(0, Date.now() - revokedAt.getTime());
    return msSinceRevoke < REFRESH_REUSE_GRACE_MS;
  }

  private generateTokens(userId: string, persistent: boolean) {

    const accessToken = this.jwtService.sign(
      { sub: userId, type: 'access' },
      { expiresIn: ACCESS_TOKEN_EXPIRES },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      {
        expiresIn: persistent
          ? PERSISTENT_REFRESH_EXPIRES
          : SESSION_REFRESH_EXPIRES,
      },
    );

    return { accessToken, refreshToken };
  }

  private refreshExpiresAt(persistent: boolean): Date {
    return new Date(
      Date.now() +
      (persistent
        ? PERSISTENT_REFRESH_EXPIRES_MS
        : SESSION_REFRESH_EXPIRES_MS),
    );
  }
}
