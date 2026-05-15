import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

const SETTINGS_BULK_CACHE_KEY = 'cache:settings:bulk:v1';
const SETTINGS_BULK_CACHE_TTL_SEC = 300;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  private fetchAllPromise: Promise<Record<string, string>> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  private async loadAll(): Promise<Record<string, string>> {
    if (this.fetchAllPromise) return this.fetchAllPromise;

    this.fetchAllPromise = (async () => {
      try {
        const cached = await this.redis
          .getJson<Record<string, string>>(SETTINGS_BULK_CACHE_KEY)
          .catch(() => null);
        if (cached) return cached;

        const rows = await this.prisma.setting.findMany();
        const map: Record<string, string> = {};
        for (const row of rows) {
          map[row.key] = row.value;
        }

        void this.redis
          .setJson(SETTINGS_BULK_CACHE_KEY, map, SETTINGS_BULK_CACHE_TTL_SEC)
          .catch((err) =>
            this.logger.warn(
              `Failed to write cache settings: ${(err as Error).message}`,
            ),
          );

        return map;
      } finally {
        this.fetchAllPromise = null;
      }
    })();

    return this.fetchAllPromise;
  }

  private async invalidateCache(): Promise<void> {
    try {
      await this.redis.del(SETTINGS_BULK_CACHE_KEY);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate cache settings: ${(err as Error).message}`,
      );
    }
  }

  async get(key: string): Promise<string | null> {
    const all = await this.loadAll();
    return all[key] ?? null;
  }

  async getJson<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(
        `Setting "${key}" contains invalid JSON — ignoring. Error: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    await this.invalidateCache();
  }

  async setJson<T>(key: string, value: T): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }

  private getEncryptionKey(): Buffer | null {
    const hex = process.env.SETTINGS_ENCRYPTION_KEY;
    if (!hex || hex.length < 64) {

      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'SETTINGS_ENCRYPTION_KEY missing or invalid in production (needs 64 hex chars = 32 bytes)',
        );
      }
      return null;
    }
    return Buffer.from(hex, 'hex');
  }

  private static readonly GCM_AUTH_TAG_LENGTH = 16;

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    if (!key) return plaintext;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
      authTagLength: SettingsService.GCM_AUTH_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const ciphertext = `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;

    let roundtrip: string;
    try {
      roundtrip = this.decryptInternal(ciphertext, key);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Encrypt self-test FAILED — ciphertext does not decrypt with same key: ${errMsg}`,
      );
      Sentry.captureException(err, {
        tags: { settings_encrypt: 'self_test_failed' },
        level: 'error',
      });
      throw new Error('Encryption integrity check failed — not saving');
    }
    if (roundtrip !== plaintext) {
      this.logger.error(
        `Encrypt self-test MISMATCH — plaintext.len=${plaintext.length}, decrypted.len=${roundtrip.length}`,
      );
      Sentry.captureMessage('Settings encrypt self-test MISMATCH', {
        tags: { settings_encrypt: 'self_test_mismatch' },
        level: 'error',
      });
      throw new Error('Encryption integrity check mismatch — not saving');
    }
    return ciphertext;
  }

  private decryptInternal(ciphertext: string, key: Buffer): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('ciphertext malformed');
    const [ivHex, tagHex, encHex] = parts;
    const tagBuf = Buffer.from(tagHex, 'hex');
    if (tagBuf.length !== SettingsService.GCM_AUTH_TAG_LENGTH) {
      throw new Error(`tag length invalid: ${tagBuf.length}`);
    }
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
      { authTagLength: SettingsService.GCM_AUTH_TAG_LENGTH },
    );
    decipher.setAuthTag(tagBuf);
    return Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  decrypt(ciphertext: string): string {
    const key = this.getEncryptionKey();
    if (!key) return ciphertext;
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return ciphertext;
    const [ivHex, tagHex, encHex] = parts;
    try {
      const tagBuf = Buffer.from(tagHex, 'hex');

      if (tagBuf.length !== SettingsService.GCM_AUTH_TAG_LENGTH) {
        this.logger.warn(
          `Invalid GCM tag length=${tagBuf.length} (expected ${SettingsService.GCM_AUTH_TAG_LENGTH}) — discarding`,
        );

        return '';
      }
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(ivHex, 'hex'),
        { authTagLength: SettingsService.GCM_AUTH_TAG_LENGTH },
      );
      decipher.setAuthTag(tagBuf);
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encHex, 'hex')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (err) {

      this.logger.error(
        `Decrypt failed — ciphertext corrupted or key changed: ${err instanceof Error ? err.message : String(err)}`,
      );
      Sentry.captureException(err, {
        tags: { settings_decrypt: 'failed' },
        level: 'error',
      });

      return '';
    }
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    if (keys.length === 0) return {};

    const all = await this.loadAll();
    const result: Record<string, string> = {};
    for (const key of keys) {
      if (all[key] !== undefined) result[key] = all[key];
    }
    return result;
  }

  async getManyFresh(keys: string[]): Promise<Record<string, string>> {
    if (keys.length === 0) return {};
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: keys } },
    });
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  private async deleteSettingIdempotent(key: string): Promise<void> {
    try {
      await this.prisma.setting.delete({ where: { key } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        await this.invalidateCache();
        return;
      }
      throw err;
    }
    await this.invalidateCache();
  }

  async getGoogleOAuthConfig(): Promise<GoogleOAuthConfig> {

    const raw = await this.getManyFresh([...GOOGLE_OAUTH_SETTING_KEYS]);
    const encSecret = raw.google_oauth_client_secret;
    const clientId = raw.google_oauth_client_id ?? null;
    const clientSecret = encSecret ? this.decrypt(encSecret) : null;
    const enabledFlag = raw.google_oauth_enabled === 'true';
    return {
      enabled: enabledFlag && Boolean(clientId) && Boolean(clientSecret),
      clientId,
      clientSecret,
    };
  }

  async setGoogleOAuthConfig(
    partial: Partial<{
      enabled: boolean;
      clientId: string | null;
      clientSecret: string | null;
    }>,
  ): Promise<void> {
    if (partial.enabled !== undefined) {
      await this.set(
        'google_oauth_enabled',
        partial.enabled ? 'true' : 'false',
      );
    }
    if (partial.clientId !== undefined) {
      if (partial.clientId === null) {
        await this.deleteSettingIdempotent('google_oauth_client_id');
      } else if (partial.clientId !== '') {
        await this.set('google_oauth_client_id', partial.clientId);
      }
    }
    if (partial.clientSecret !== undefined) {
      if (partial.clientSecret === null) {
        await this.deleteSettingIdempotent('google_oauth_client_secret');
      } else if (partial.clientSecret !== '') {
        await this.set(
          'google_oauth_client_secret',
          this.encrypt(partial.clientSecret),
        );
      }

    }
  }

  async getAcceptBusinessCustomers(): Promise<boolean> {
    const raw = await this.get('accept_business_customers');
    return raw === 'true';
  }

  async setAcceptBusinessCustomers(enabled: boolean): Promise<void> {
    await this.set('accept_business_customers', enabled ? 'true' : 'false');
  }

  async getAbandonmentSettings(): Promise<AbandonmentSettings> {
    const raw = await this.getMany([...ABANDONMENT_SETTING_KEYS]);
    return {
      firstEnabled: parseBool(raw.cart_abandonment_first_enabled, false),
      firstDelayHours: parseInt(raw.cart_abandonment_first_delay_hours, 24),
      secondEnabled: parseBool(raw.cart_abandonment_second_enabled, false),
      secondDelayHours: parseInt(raw.cart_abandonment_second_delay_hours, 48),
      couponType: parseCouponTypeNullable(raw.cart_abandonment_coupon_type),
      couponValue: parseNumNullable(raw.cart_abandonment_coupon_value),
      couponValidityHours: parseIntNullable(
        raw.cart_abandonment_coupon_validity_hours,
      ),
      couponMinOrderValue: parseNum(
        raw.cart_abandonment_coupon_min_order_value,
        0,
      ),
    };
  }

  async getReviewSettings(): Promise<ReviewSettings> {
    const raw = await this.getMany([...REVIEW_SETTING_KEYS]);
    return {
      enabled: parseBool(raw.review_enabled, REVIEW_DEFAULTS.enabled),
      firstEmailDays: parseInt(
        raw.review_first_email_days,
        REVIEW_DEFAULTS.firstEmailDays,
      ),
      reminderDays: parseInt(
        raw.review_reminder_days,
        REVIEW_DEFAULTS.reminderDays,
      ),
      couponType: parseCouponType(raw.review_coupon_type),
      couponValue: parseNum(
        raw.review_coupon_value,
        REVIEW_DEFAULTS.couponValue,
      ),
      couponValidityDays: parseInt(
        raw.review_coupon_validity_days,
        REVIEW_DEFAULTS.couponValidityDays,
      ),
      couponMinOrder: parseNum(
        raw.review_coupon_min_order,
        REVIEW_DEFAULTS.couponMinOrder,
      ),
      couponStackable: parseBool(
        raw.review_coupon_stackable,
        REVIEW_DEFAULTS.couponStackable,
      ),
      maxPhotos: parseInt(raw.review_max_photos, REVIEW_DEFAULTS.maxPhotos),
      maxPhotoSizeMb: parseInt(
        raw.review_max_photo_size_mb,
        REVIEW_DEFAULTS.maxPhotoSizeMb,
      ),
      inviteValidityDays: parseInt(
        raw.review_invite_validity_days,
        REVIEW_DEFAULTS.inviteValidityDays,
      ),
    };
  }
}

export interface ReviewSettings {
  enabled: boolean;
  firstEmailDays: number;
  reminderDays: number;
  couponType: 'PERCENTAGE' | 'FIXED';
  couponValue: number;
  couponValidityDays: number;
  couponMinOrder: number;

  couponStackable: boolean;
  maxPhotos: number;
  maxPhotoSizeMb: number;
  inviteValidityDays: number;
}

const REVIEW_DEFAULTS: ReviewSettings = {
  enabled: true,
  firstEmailDays: 2,
  reminderDays: 2,
  couponType: 'PERCENTAGE',
  couponValue: 10,
  couponValidityDays: 30,
  couponMinOrder: 0,
  couponStackable: false,
  maxPhotos: 5,
  maxPhotoSizeMb: 5,
  inviteValidityDays: 30,
};

export interface GoogleOAuthConfig {
  enabled: boolean;
  clientId: string | null;
  clientSecret: string | null;
}

export const GOOGLE_OAUTH_SETTING_KEYS = [
  'google_oauth_enabled',
  'google_oauth_client_id',
  'google_oauth_client_secret',
] as const;

export interface AbandonmentSettings {
  firstEnabled: boolean;
  firstDelayHours: number;
  secondEnabled: boolean;
  secondDelayHours: number;

  couponType: 'PERCENTAGE' | 'FIXED' | null;
  couponValue: number | null;
  couponValidityHours: number | null;
  couponMinOrderValue: number;
}

export const ABANDONMENT_SETTING_KEYS = [
  'cart_abandonment_first_enabled',
  'cart_abandonment_first_delay_hours',
  'cart_abandonment_second_enabled',
  'cart_abandonment_second_delay_hours',
  'cart_abandonment_coupon_type',
  'cart_abandonment_coupon_value',
  'cart_abandonment_coupon_validity_hours',
  'cart_abandonment_coupon_min_order_value',
] as const;

export const REVIEW_SETTING_KEYS = [
  'review_enabled',
  'review_first_email_days',
  'review_reminder_days',
  'review_coupon_type',
  'review_coupon_value',
  'review_coupon_validity_days',
  'review_coupon_min_order',
  'review_coupon_stackable',
  'review_max_photos',
  'review_max_photo_size_mb',
  'review_invite_validity_days',
] as const;

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

function parseNum(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseInt(raw: string | undefined, fallback: number): number {
  const n = parseNum(raw, fallback);
  return Math.trunc(n);
}

function parseCouponType(raw: string | undefined): 'PERCENTAGE' | 'FIXED' {
  return raw === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
}

function parseCouponTypeNullable(
  raw: string | undefined,
): 'PERCENTAGE' | 'FIXED' | null {
  if (raw === 'PERCENTAGE') return 'PERCENTAGE';
  if (raw === 'FIXED') return 'FIXED';
  return null;
}

function parseNumNullable(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseIntNullable(raw: string | undefined): number | null {
  const n = parseNumNullable(raw);
  return n === null ? null : Math.trunc(n);
}
