import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { SettingsService } from '../settings/settings.service';
import { SecurityService } from '../security/security.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { IdentifyDto } from './dto/identify.dto';
import { RequestLoginCodeDto } from './dto/request-login-code.dto';
import { VerifyLoginCodeDto } from './dto/verify-login-code.dto';
import { GuestCheckoutDto } from './dto/guest-checkout.dto';
import { SetGoogleOAuthAdminDto } from './dto/google-oauth-admin.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  clearRefreshCookie,
  OAUTH_STATE_COOKIE_NAME,
  setOAuthStateCookie,
  clearOAuthStateCookie,
} from './cookie.helper';

function safeNext(raw: string | undefined | null, fallback = '/'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return fallback;

  const lower = trimmed.toLowerCase();
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    lower.startsWith('/%2f') ||
    lower.startsWith('/%5c')
  ) {
    return fallback;
  }

  if (trimmed.length > 500) return fallback;
  try {

    const parsed = new URL(trimmed, 'http://_safe-redirect-base_');
    if (parsed.host !== '_safe-redirect-base_') return fallback;

    if (parsed.pathname.includes('..')) return fallback;

    if (/[\x00-\x1f]/.test(parsed.pathname + parsed.search + parsed.hash)) {
      return fallback;
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

function getCallbackBaseUrl(req: Request): string {
  const protocol = req.protocol;
  const host = req.get('host') ?? 'localhost:3002';
  return `${protocol}://${host}`;
}

function getFrontendUrl(req: Request): string {
  const fromEnv = process.env.FRONTEND_URL;
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FRONTEND_URL not configured in production — redirect blocked',
    );
  }
  const protocol = req.protocol;
  const host = req.get('host') ?? 'localhost:3000';
  return `${protocol}://${host}`;
}

@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly securityService: SecurityService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly settings: SettingsService,
  ) { }

  @Roles('ADMIN')
  @Get('admin/google-oauth')
  async getGoogleOAuthAdmin(@Req() req: Request) {
    const cfg = await this.settings.getGoogleOAuthConfig();
    return {
      data: {
        enabled: cfg.enabled,
        clientId: cfg.clientId,

        hasClientSecret: Boolean(cfg.clientSecret),
        callbackUrl: `${getCallbackBaseUrl(req)}/api/v1/auth/google/callback`,
      },
    };
  }

  @Roles('ADMIN')
  @Put('admin/google-oauth')
  async setGoogleOAuthAdmin(@Body() body: SetGoogleOAuthAdminDto) {

    const partial: Parameters<SettingsService['setGoogleOAuthConfig']>[0] = {};
    if (typeof body.enabled === 'boolean') partial.enabled = body.enabled;
    if (body.clientId === null || typeof body.clientId === 'string') {
      partial.clientId =
        typeof body.clientId === 'string'
          ? body.clientId.trim()
          : body.clientId;
    }
    if (body.clientSecret === null || typeof body.clientSecret === 'string') {
      partial.clientSecret =
        typeof body.clientSecret === 'string'
          ? body.clientSecret.trim()
          : body.clientSecret;
    }
    await this.settings.setGoogleOAuthConfig(partial);
    return { data: { ok: true } };
  }

  @Public()
  @Get('methods')
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  async authMethods() {
    try {
      const cfg = await this.settings.getGoogleOAuthConfig();
      return { data: { googleEnabled: cfg.enabled } };
    } catch (err) {
      this.logger.warn(
        `authMethods: settings unavailable, defaulting googleEnabled=false (${err instanceof Error ? err.message : 'unknown'
        })`,
      );
      return { data: { googleEnabled: false } };
    }
  }

  @Public()
  @Get('google')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async googleStart(
    @Query('next') next: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const safeNextPath = safeNext(next);
    const state = randomBytes(16).toString('hex');
    const redirectUri = `${getCallbackBaseUrl(req)}/api/v1/auth/google/callback`;

    const authUrl = await this.googleOAuth.getAuthUrl(state, redirectUri);
    if (!authUrl) {
      return res.redirect(
        `${getFrontendUrl(req)}/login?oauth_error=google_disabled`,
      );
    }

    setOAuthStateCookie(res, JSON.stringify({ state, next: safeNextPath }));
    return res.redirect(authUrl);
  }

  @Public()
  @Get('google/callback')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const stateCookie = cookies?.[OAUTH_STATE_COOKIE_NAME];

    clearOAuthStateCookie(res);

    if (error) {

      return res.redirect(
        `${getFrontendUrl(req)}/login?oauth_error=user_cancelled`,
      );
    }
    if (!code || !state || !stateCookie) {
      return res.redirect(
        `${getFrontendUrl(req)}/login?oauth_error=missing_state`,
      );
    }

    let parsed: { state: string; next: string };
    try {
      parsed = JSON.parse(stateCookie) as { state: string; next: string };
    } catch {
      return res.redirect(
        `${getFrontendUrl(req)}/login?oauth_error=corrupt_state`,
      );
    }

    if (parsed.state !== state) {
      return res.redirect(
        `${getFrontendUrl(req)}/login?oauth_error=state_mismatch`,
      );
    }

    const redirectUri = `${getCallbackBaseUrl(req)}/api/v1/auth/google/callback`;

    let profile: Awaited<ReturnType<GoogleOAuthService['exchangeCode']>>;
    try {
      profile = await this.googleOAuth.exchangeCode(code, redirectUri);
    } catch (err) {
      this.logger.warn(
        `Google OAuth exchange failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return res.redirect(
        `${getFrontendUrl(req)}/login?oauth_error=exchange_failed`,
      );
    }

    if (!profile.emailVerified) {
      return res.redirect(
        `${getFrontendUrl(req)}/login?oauth_error=email_unverified`,
      );
    }

    let result;
    try {
      result = await this.authService.loginOrCreateWithGoogle(profile);
    } catch (err) {
      this.logger.warn(
        `Google login/create failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return res.redirect(
        `${getFrontendUrl(req)}/login?oauth_error=login_failed`,
      );
    }

    setRefreshCookie(res, result.refreshToken, result.persistent);
    const finalNext = safeNext(parsed.next);
    return res.redirect(
      `${getFrontendUrl(req)}/auth/callback/google?next=${encodeURIComponent(finalNext)}`,
    );
  }

  @Public()
  @Post('register')
  @Throttle({ long: { limit: 5, ttl: 86400000 } })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return { data: user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)

  @Throttle({
    short: { limit: 5, ttl: 60000 },
    long: { limit: 50, ttl: 86400000 },
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.login(dto);

      setRefreshCookie(res, result.refreshToken, result.persistent);
      return {
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        const ip =
          req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
        await this.securityService.recordFailedAttempt(
          ip,
          `Login failed for ${dto.email}`,
          req.headers['user-agent'],
        );
      }
      throw err;
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)

  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }
    const result = await this.authService.refreshToken(token);

    setRefreshCookie(res, result.refreshToken, result.persistent);
    return { data: { accessToken: result.accessToken } };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_COOKIE_NAME];

    clearRefreshCookie(res);
    if (token) {

      await this.authService.revokeRefreshTokenFamily(token).catch((err) => {

        this.logger.error(
          `Logout: revokeRefreshTokenFamily failed — token in DB: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
    return { data: { success: true } };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 3, ttl: 3600000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    try {
      await this.authService.resetPassword(dto.token, dto.newPassword);
      return { message: 'Password reset successfully' };
    } catch (err) {
      if (err instanceof BadRequestException) {
        const ip =
          req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
        await this.securityService.recordFailedAttempt(
          ip,
          'Invalid or expired reset token',
          req.headers['user-agent'],
        );
      }
      throw err;
    }
  }

  @Public()
  @Post('identify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  async identify(@Body() dto: IdentifyDto) {
    return { data: await this.authService.identify(dto.email) };
  }

  @Public()
  @Post('login-code/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 5, ttl: 60000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  async requestLoginCode(@Body() dto: RequestLoginCodeDto) {
    await this.authService.requestLoginCode(dto.email, dto.purpose ?? 'LOGIN');
    return { data: { ok: true } };
  }

  @Public()
  @Post('login-code/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async verifyLoginCode(
    @Body() dto: VerifyLoginCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.verifyLoginCode(
        dto.email,
        dto.code,
        dto.rememberMe ?? false,
      );
      setRefreshCookie(res, result.refreshToken, result.persistent);
      return {
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        const ip =
          req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
        await this.securityService.recordFailedAttempt(
          ip,
          `Login code invalid for ${dto.email}`,
          req.headers['user-agent'],
        );
      }
      throw err;
    }
  }

  @Public()
  @Post('guest-checkout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  async guestCheckout(
    @Body() dto: GuestCheckoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginOrCreateForGuest({
      email: dto.email,
      marketingConsent: dto.marketingConsent ?? false,
    });

    setRefreshCookie(res, result.refreshToken, result.persistent);
    return {
      data: {
        accessToken: result.accessToken,
        user: result.user,
        isShadow: result.isShadow,
      },
    };
  }
}
