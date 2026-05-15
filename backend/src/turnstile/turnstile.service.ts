import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5_000;

interface CfSiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly configService: ConfigService) { }

  async verify(token: string, remoteip?: string): Promise<boolean> {
    if (!token || !token.trim()) return false;

    const secret = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      this.logger.error(
        'TURNSTILE_SECRET_KEY not configured — rejecting verification',
      );
      return false;
    }

    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);
    if (remoteip) body.append('remoteip', remoteip);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`siteverify returned status ${res.status}`);
        return false;
      }
      const data = (await res.json()) as CfSiteverifyResponse;
      if (!data.success) {
        this.logger.warn(
          `Turnstile failed: ${(data['error-codes'] ?? []).join(',') || 'unknown'}`,
        );
      }
      return data.success === true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`siteverify fetch error: ${msg}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
