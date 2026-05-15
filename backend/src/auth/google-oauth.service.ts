import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(private readonly settings: SettingsService) { }

  async getAuthUrl(state: string, redirectUri: string): Promise<string | null> {
    const config = await this.settings.getGoogleOAuthConfig();
    if (!config.enabled || !config.clientId) return null;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',

      scope: 'openid email profile',

      access_type: 'online',

      prompt: 'select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<GoogleProfile> {
    const config = await this.settings.getGoogleOAuthConfig();
    if (!config.enabled || !config.clientId || !config.clientSecret) {
      throw new BadRequestException('Google OAuth not configured');
    }

    let idToken: string;
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenJson = (await tokenRes.json()) as {
        id_token?: string;
        error?: string;
      };
      if (!tokenRes.ok || !tokenJson.id_token) {

        this.logger.warn(
          `Google token exchange failed: ${tokenJson.error ?? 'unknown'}`,
        );
        throw new BadRequestException('Google token exchange failed');
      }
      idToken = tokenJson.id_token;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(
        `Google token exchange error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Failed contacting Google');
    }

    let payload: TokenPayload | undefined;
    try {
      const client = new OAuth2Client(config.clientId);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: config.clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(
        `verifyIdToken error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException('Invalid or expired id_token');
    }

    if (!payload?.sub || !payload.email) {
      throw new BadRequestException('id_token without essential fields');
    }

    const picture =
      payload.picture && payload.picture.length <= 2048
        ? payload.picture
        : null;

    return {
      googleId: payload.sub,
      email: payload.email,

      emailVerified:
        payload.email_verified === true ||
        (payload.email_verified as unknown) === 'true',
      name: payload.name ?? null,
      picture,
    };
  }
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}
