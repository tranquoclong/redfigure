import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from '../turnstile/turnstile.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import { parseEmailRecipients } from '../common/utils/email-recipients';

function sanitizeLogValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/[\r\n]+/g, ' ').slice(0, 255);
}

export interface ContactSubmitInput {
  name: string;
  email: string;
  message: string;
  turnstileToken: string;
  acceptLgpd: boolean;
  honeypot?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly settings: SettingsService,
    private readonly turnstile: TurnstileService,
    private readonly email: EmailService,
  ) { }

  private async resolveRecipients(): Promise<string[]> {
    const csv = await this.settings.get('low_stock_email_recipients');
    const fromDb = parseEmailRecipients(csv);
    if (fromDb.length > 0) return fromDb;
    const envFallback = this.configService.get<string>('ADMIN_EMAIL');
    return parseEmailRecipients(envFallback);
  }

  async submit(input: ContactSubmitInput): Promise<{ ok: true }> {

    const safeIp = sanitizeLogValue(input.ipAddress);
    const safeUa = sanitizeLogValue(input.userAgent);

    if (typeof input.honeypot === 'string' && input.honeypot.length > 0) {
      this.logger.warn(
        `Honeypot activated from ${safeIp ?? 'unknown-ip'} (UA="${safeUa ?? '-'}")`,
      );
      return { ok: true };
    }

    if (input.acceptLgpd !== true) {
      throw new BadRequestException(
        'You must accept the Privacy Policy to send the message.',
      );
    }

    const ok = await this.turnstile.verify(input.turnstileToken, safeIp);
    if (!ok) {
      throw new BadRequestException(
        'Security verification failed. Please reload the page and try again.',
      );
    }

    const recipients = await this.resolveRecipients();
    if (recipients.length === 0) {
      this.logger.error(
        'No admin recipient configured (setting low_stock_email_recipients empty + ADMIN_EMAIL env empty) — message discarded',
      );
      throw new InternalServerErrorException(
        'Contact service temporarily unavailable.',
      );
    }

    try {

      await this.email.sendContactMessage({
        to: recipients.join(', '),
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        message: input.message.trim(),
        ipAddress: safeIp,
        userAgent: safeUa,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send contact email: ${msg}`);
      throw new InternalServerErrorException(
        'Failed to send your message. Please try again in a moment.',
      );
    }

    return { ok: true };
  }
}
