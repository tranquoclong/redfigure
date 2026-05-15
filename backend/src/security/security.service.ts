import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const PREFIX_ATTEMPTS = 'security:attempts:';
const PREFIX_BAN = 'security:ban:';
const PREFIX_LOG = 'security:log:';

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_BAN_SECONDS = 60 * 60;
const MAX_LOG_ENTRIES = 100;

export interface BanInfo {
  ip: string;
  reason: string;
  bannedAt: string;
  expiresAt: string;
  ttl: number;
}

export interface AttemptLog {
  ip: string;
  reason: string;
  userAgent?: string;
  timestamp: string;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(private readonly redis: RedisService) { }

  async recordFailedAttempt(
    ip: string,
    reason: string,
    userAgent?: string,
  ): Promise<boolean> {
    const key = `${PREFIX_ATTEMPTS}${ip}`;

    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, DEFAULT_WINDOW_SECONDS);
    }

    await this.logAttempt({
      ip,
      reason,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    this.logger.warn(`Failed attempt #${count} from ${ip}: ${reason}`);

    if (count >= DEFAULT_MAX_ATTEMPTS) {
      await this.banIp(
        ip,
        `Auto-ban: ${count} failed attempts in ${DEFAULT_WINDOW_SECONDS / 60}min (${reason})`,
      );
      return true;
    }

    return false;
  }

  async banIp(ip: string, reason: string): Promise<void> {
    const banData = {
      ip,
      reason,
      bannedAt: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + DEFAULT_BAN_SECONDS * 1000,
      ).toISOString(),
    };

    await this.redis.setJson(
      `${PREFIX_BAN}${ip}`,
      banData,
      DEFAULT_BAN_SECONDS,
    );

    await this.redis.del(`${PREFIX_ATTEMPTS}${ip}`);

    this.logger.error(`IP BANNED: ${ip} — ${reason}`);
  }

  async isBanned(ip: string): Promise<BanInfo | null> {
    const data = await this.redis.getJson<Omit<BanInfo, 'ttl'>>(
      `${PREFIX_BAN}${ip}`,
    );
    if (!data) return null;

    const ttl = await this.redis.ttl(`${PREFIX_BAN}${ip}`);
    return { ...data, ttl };
  }

  async unbanIp(ip: string): Promise<void> {
    await this.redis.del(`${PREFIX_BAN}${ip}`);
    await this.redis.del(`${PREFIX_ATTEMPTS}${ip}`);
    this.logger.log(`IP UNBANNED: ${ip}`);
  }

  async listBans(): Promise<BanInfo[]> {
    const keys = await this.redis.keys(`${PREFIX_BAN}*`);
    const bans: BanInfo[] = [];

    for (const key of keys) {
      const data = await this.redis.getJson<Omit<BanInfo, 'ttl'>>(key);
      if (data) {
        const ttl = await this.redis.ttl(key);
        bans.push({ ...data, ttl });
      }
    }

    return bans.sort((a, b) => b.bannedAt.localeCompare(a.bannedAt));
  }

  async getAttemptCount(ip: string): Promise<number> {
    const val = await this.redis.get(`${PREFIX_ATTEMPTS}${ip}`);
    return val ? parseInt(val, 10) : 0;
  }

  private async logAttempt(entry: AttemptLog): Promise<void> {
    const key = PREFIX_LOG + 'recent';
    const list = (await this.redis.getJson<AttemptLog[]>(key)) ?? [];

    list.unshift(entry);
    if (list.length > MAX_LOG_ENTRIES) list.length = MAX_LOG_ENTRIES;

    await this.redis.setJson(key, list, 86400);
  }

  async getRecentAttempts(limit = 50): Promise<AttemptLog[]> {
    const list =
      (await this.redis.getJson<AttemptLog[]>(PREFIX_LOG + 'recent')) ?? [];
    return list.slice(0, limit);
  }
}
