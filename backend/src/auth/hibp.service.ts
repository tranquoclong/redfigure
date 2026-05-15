import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class HibpService {
  private readonly logger = new Logger(HibpService.name);
  private readonly timeoutMs = 3000;

  async isPwned(password: string): Promise<boolean> {

    const sha1 = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          method: 'GET',
          headers: { 'User-Agent': 'RedFigure-password-check' },
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`HIBP returned non-OK status ${response.status}`);
        return false;
      }

      const body = await response.text();
      const lines = body.split('\n');

      for (const line of lines) {
        const [lineSuffix] = line.split(':');
        if (lineSuffix.trim().toUpperCase() === suffix) {
          return true;
        }
      }
      return false;
    } catch (err) {
      this.logger.warn(
        `HIBP check failed: ${err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}
