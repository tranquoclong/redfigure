import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  WEBHOOK_SIGNATURE_KEY,
  type WebhookProvider,
} from '../decorators/webhook-signature.decorator';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const provider = this.reflector.getAllAndOverride<
      WebhookProvider | undefined
    >(WEBHOOK_SIGNATURE_KEY, [context.getHandler(), context.getClass()]);

    if (!provider) {
      this.logger.warn(
        'WebhookSignatureGuard ativado sem @WebhookSignature() — fail-closed',
      );
      throw new UnauthorizedException('Webhook misconfigured');
    }

    const req = context.switchToHttp().getRequest();

    switch (provider) {
      case 'sepay':
        return await this.validateSePay(req);
      default:
        throw new UnauthorizedException('Unknown webhook provider');
    }
  }

  /**
   * SePay webhook xác thực bằng API key trong header Authorization.
   * Header: Authorization: Apikey <api_key>
   * https://docs.sepay.vn/tich-hop-webhooks.html
   */
  private async validateSePay(req: any): Promise<boolean> {
    const REJECT = 'Invalid webhook';
    const authHeader: string | undefined = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Apikey ')) {
      this.logger.warn('SePay webhook without Authorization Apikey header — rejected');
      throw new UnauthorizedException(REJECT);
    }

    const providedKey = authHeader.slice('Apikey '.length);
    if (!providedKey) {
      throw new UnauthorizedException(REJECT);
    }

    // Lấy API key từ Settings (encrypted) hoặc env
    const encKey = await this.settings.get('sepay_api_key');
    let expectedKey: string | undefined;

    if (encKey) {
      try {
        expectedKey = this.settings.decrypt(encKey);
      } catch (err) {
        this.logger.error(
          `SePay API key decryption failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw new UnauthorizedException(REJECT);
      }
    } else {
      // Fallback to env variable
      expectedKey = this.config.get<string>('SEPAY_API_KEY');
    }

    if (!expectedKey) {
      this.logger.warn('SEPAY_API_KEY not configured — fail-closed');
      throw new UnauthorizedException(REJECT);
    }

    // Timing-safe compare via SHA256 hash
    const expectedHash = Buffer.from(expectedKey, 'utf8');
    const providedHash = Buffer.from(providedKey, 'utf8');

    // Lengths must match for timingSafeEqual
    if (expectedHash.length !== providedHash.length) {
      this.logger.warn('SePay API key length mismatch');
      throw new UnauthorizedException(REJECT);
    }

    if (!timingSafeEqual(expectedHash, providedHash)) {
      this.logger.warn('Invalid SePay webhook API key');
      throw new UnauthorizedException(REJECT);
    }

    return true;
  }
}