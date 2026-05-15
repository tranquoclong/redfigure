import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: PrismaService;
  let redis: { getJson: jest.Mock; setJson: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: {
            setting: {
              findUnique: jest.fn(),

              findMany: jest.fn().mockResolvedValue([]),
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: redis,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('get', () => {
    it('returns the value when key exists', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', key: 'site_name', value: 'Red Figure' },
      ]);
      const result = await service.get('site_name');
      expect(result).toBe('Red Figure');
    });

    it('returns null when key does not exist', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.get('missing_key');
      expect(result).toBeNull();
    });
  });

  describe('getJson', () => {
    it('parses JSON value', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', key: 'site_marquee', value: '["A","B","C"]' },
      ]);
      const result = await service.getJson<string[]>('site_marquee');
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('returns null when key is missing', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getJson('missing');
      expect(result).toBeNull();
    });

    it('returns null and does NOT throw when stored value is invalid JSON', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', key: 'broken', value: '{not json' },
      ]);
      const result = await service.getJson('broken');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('upserts the key with the given value', async () => {
      (prisma.setting.upsert as jest.Mock).mockResolvedValue({});
      await service.set('site_name', 'Red Figure');
      expect(prisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: 'site_name' },
        create: { key: 'site_name', value: 'Red Figure' },
        update: { value: 'Red Figure' },
      });
    });
  });

  describe('setJson', () => {
    it('serializes the value as JSON before upserting', async () => {
      (prisma.setting.upsert as jest.Mock).mockResolvedValue({});
      await service.setJson('site_marquee', ['A', 'B']);
      expect(prisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: 'site_marquee' },
        create: { key: 'site_marquee', value: '["A","B"]' },
        update: { value: '["A","B"]' },
      });
    });
  });

  describe('getMany', () => {
    it('returns a Record<key, value> for the requested keys', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'site_name', value: 'Red Figure' },
        { key: 'free_shipping_threshold', value: '299' },
      ]);
      const result = await service.getMany([
        'site_name',
        'free_shipping_threshold',
      ]);
      expect(result).toEqual({
        site_name: 'Red Figure',
        free_shipping_threshold: '299',
      });
    });

    it('omits keys that are not present in the database', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'site_name', value: 'Red Figure' },
      ]);
      const result = await service.getMany(['site_name', 'missing']);
      expect(result).toEqual({ site_name: 'Red Figure' });
    });
  });

  describe('getReviewSettings', () => {
    it('returns safe defaults when no keys are stored', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getReviewSettings();
      expect(result).toEqual({
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
      });
    });

    it('parses stored values and overrides defaults', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'review_enabled', value: 'false' },
        { key: 'review_first_email_days', value: '5' },
        { key: 'review_reminder_days', value: '3' },
        { key: 'review_coupon_type', value: 'FIXED' },
        { key: 'review_coupon_value', value: '25' },
        { key: 'review_coupon_validity_days', value: '60' },
        { key: 'review_coupon_min_order', value: '100' },
        { key: 'review_coupon_stackable', value: 'true' },
        { key: 'review_max_photos', value: '3' },
        { key: 'review_max_photo_size_mb', value: '2' },
        { key: 'review_invite_validity_days', value: '45' },
      ]);
      const result = await service.getReviewSettings();
      expect(result).toEqual({
        enabled: false,
        firstEmailDays: 5,
        reminderDays: 3,
        couponType: 'FIXED',
        couponValue: 25,
        couponValidityDays: 60,
        couponMinOrder: 100,
        couponStackable: true,
        maxPhotos: 3,
        maxPhotoSizeMb: 2,
        inviteValidityDays: 45,
      });
    });

    it('falls back to defaults when numeric values are invalid', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'review_first_email_days', value: 'abc' },
        { key: 'review_coupon_value', value: '' },
      ]);
      const result = await service.getReviewSettings();
      expect(result.firstEmailDays).toBe(2);
      expect(result.couponValue).toBe(10);
    });

    it('rejects invalid couponType and falls back to PERCENTAGE', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'review_coupon_type', value: 'BOGUS' },
      ]);
      const result = await service.getReviewSettings();
      expect(result.couponType).toBe('PERCENTAGE');
    });
  });

  describe('setGoogleOAuthConfig', () => {
    it('encrypts clientSecret before saving (never plaintext)', async () => {
      const upsertMock = prisma.setting.upsert as jest.Mock;
      upsertMock.mockResolvedValue({});

      await service.setGoogleOAuthConfig({
        clientSecret: 'GOCSPX-supersecret',
      });

      const call = upsertMock.mock.calls.find(
        (c) => c[0]?.where?.key === 'google_oauth_client_secret',
      );
      expect(call).toBeDefined();
      expect(call[0].create.value).toBe(service.encrypt('GOCSPX-supersecret'));
    });

    it('clientId stored in plaintext (not a secret)', async () => {
      const upsertMock = prisma.setting.upsert as jest.Mock;
      upsertMock.mockResolvedValue({});

      await service.setGoogleOAuthConfig({
        clientId: '123-abc.apps.googleusercontent.com',
      });

      const call = upsertMock.mock.calls.find(
        (c) => c[0]?.where?.key === 'google_oauth_client_id',
      );
      expect(call).toBeDefined();
      expect(call[0].create.value).toBe('123-abc.apps.googleusercontent.com');
    });

    it('enabled=true stored as string "true"', async () => {
      const upsertMock = prisma.setting.upsert as jest.Mock;
      upsertMock.mockResolvedValue({});

      await service.setGoogleOAuthConfig({ enabled: true });

      const call = upsertMock.mock.calls.find(
        (c) => c[0]?.where?.key === 'google_oauth_enabled',
      );
      expect(call[0].create.value).toBe('true');
    });

    it('clientSecret=null deletes the setting', async () => {
      const deleteMock = jest.fn().mockResolvedValue({});
      (prisma as { setting: { delete: jest.Mock } }).setting.delete =
        deleteMock;

      await service.setGoogleOAuthConfig({ clientSecret: null });

      expect(deleteMock).toHaveBeenCalledWith({
        where: { key: 'google_oauth_client_secret' },
      });
    });

    it('clientSecret="" no-op (preserves existing — admin did not re-enter)', async () => {
      const upsertMock = prisma.setting.upsert as jest.Mock;
      const deleteMock = jest.fn().mockResolvedValue({});
      (prisma as { setting: { delete: jest.Mock } }).setting.delete =
        deleteMock;

      await service.setGoogleOAuthConfig({ clientSecret: '' });

      expect(upsertMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'google_oauth_client_secret' },
        }),
      );
      expect(deleteMock).not.toHaveBeenCalled();
    });
  });

  describe('getGoogleOAuthConfig', () => {
    it('decrypts saved clientSecret', async () => {
      const plain = 'GOCSPX-real-secret';
      const encrypted = service.encrypt(plain);
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'google_oauth_enabled', value: 'true' },
        { key: 'google_oauth_client_id', value: '123.apps.gc.com' },
        { key: 'google_oauth_client_secret', value: encrypted },
      ]);

      const result = await service.getGoogleOAuthConfig();

      expect(result.clientSecret).toBe(plain);
      expect(result.clientId).toBe('123.apps.gc.com');
      expect(result.enabled).toBe(true);
    });

    it('enabled=false when clientId is absent (even with toggle ON)', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'google_oauth_enabled', value: 'true' },

      ]);

      const result = await service.getGoogleOAuthConfig();

      expect(result.enabled).toBe(false);
      expect(result.clientId).toBeNull();
    });

    it('enabled=false when clientSecret is absent', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'google_oauth_enabled', value: 'true' },
        { key: 'google_oauth_client_id', value: '123.apps.gc.com' },
      ]);

      const result = await service.getGoogleOAuthConfig();

      expect(result.enabled).toBe(false);
    });

    it('enabled=false when admin disabled toggle (even with filled keys)', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'google_oauth_enabled', value: 'false' },
        { key: 'google_oauth_client_id', value: '123.apps.gc.com' },
        {
          key: 'google_oauth_client_secret',
          value: service.encrypt('s'),
        },
      ]);

      const result = await service.getGoogleOAuthConfig();

      expect(result.enabled).toBe(false);
    });

    it('returns empty shape when nothing is configured', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getGoogleOAuthConfig();

      expect(result).toEqual({
        enabled: false,
        clientId: null,
        clientSecret: null,
      });
    });
  });

  describe('getAcceptBusinessCustomers', () => {

    it('returns false by default when key is missing', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getAcceptBusinessCustomers();
      expect(result).toBe(false);
    });

    it('returns true when stored value is "true"', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', key: 'accept_business_customers', value: 'true' },
      ]);
      const result = await service.getAcceptBusinessCustomers();
      expect(result).toBe(true);
    });

    it('returns false when stored value is "false"', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', key: 'accept_business_customers', value: 'false' },
      ]);
      const result = await service.getAcceptBusinessCustomers();
      expect(result).toBe(false);
    });

    it('returns false when stored value is garbage (fail-closed)', async () => {
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', key: 'accept_business_customers', value: 'maybe' },
      ]);
      const result = await service.getAcceptBusinessCustomers();
      expect(result).toBe(false);
    });
  });

  describe('setAcceptBusinessCustomers', () => {
    it('upserts "true" when enabling', async () => {
      (prisma.setting.upsert as jest.Mock).mockResolvedValue({});
      await service.setAcceptBusinessCustomers(true);
      expect(prisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: 'accept_business_customers' },
        create: { key: 'accept_business_customers', value: 'true' },
        update: { value: 'true' },
      });
    });

    it('upserts "false" when disabling', async () => {
      (prisma.setting.upsert as jest.Mock).mockResolvedValue({});
      await service.setAcceptBusinessCustomers(false);
      expect(prisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: 'accept_business_customers' },
        create: { key: 'accept_business_customers', value: 'false' },
        update: { value: 'false' },
      });
    });
  });

  describe('Redis cache (read-through)', () => {
    const SETTINGS_BULK_KEY = 'cache:settings:bulk:v1';
    const SETTINGS_BULK_TTL = 300;

    it('get uses cache hit without touching DB', async () => {
      redis.getJson.mockResolvedValue({
        site_name: 'Cached Pinup',
        free_shipping_threshold: '299',
      });

      const result = await service.get('site_name');

      expect(result).toBe('Cached Pinup');
      expect(redis.getJson).toHaveBeenCalledWith(SETTINGS_BULK_KEY);
      expect(prisma.setting.findMany).not.toHaveBeenCalled();
      expect(prisma.setting.findUnique).not.toHaveBeenCalled();
    });

    it('get falls back to DB on cache miss and populates cache', async () => {
      redis.getJson.mockResolvedValue(null);
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'site_name', value: 'DB Pinup' },
        { key: 'free_shipping_threshold', value: '199' },
      ]);

      const result = await service.get('site_name');

      expect(result).toBe('DB Pinup');
      expect(prisma.setting.findMany).toHaveBeenCalledTimes(1);
      expect(redis.setJson).toHaveBeenCalledWith(
        SETTINGS_BULK_KEY,
        {
          site_name: 'DB Pinup',
          free_shipping_threshold: '199',
        },
        SETTINGS_BULK_TTL,
      );
    });

    it('get returns null when key does not exist in cache or DB', async () => {
      redis.getJson.mockResolvedValue(null);
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.get('missing_key');

      expect(result).toBeNull();
    });

    it('get falls back to DB if Redis fails (graceful degradation)', async () => {
      redis.getJson.mockRejectedValue(new Error('Redis connection lost'));
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'site_name', value: 'Fallback' },
      ]);

      const result = await service.get('site_name');

      expect(result).toBe('Fallback');
      expect(prisma.setting.findMany).toHaveBeenCalledTimes(1);
    });

    it('get does not propagate error if setJson fails (best-effort)', async () => {
      redis.getJson.mockResolvedValue(null);
      redis.setJson.mockRejectedValue(new Error('Redis OOM'));
      (prisma.setting.findMany as jest.Mock).mockResolvedValue([
        { key: 'k', value: 'v' },
      ]);

      const result = await service.get('k');
      expect(result).toBe('v');
    });

    it('getMany uses the same bulk cache (1 Redis read covers N keys)', async () => {
      redis.getJson.mockResolvedValue({
        a: '1',
        b: '2',
        c: '3',
      });

      const result = await service.getMany(['a', 'b', 'missing']);

      expect(result).toEqual({ a: '1', b: '2' });
      expect(redis.getJson).toHaveBeenCalledTimes(1);
      expect(prisma.setting.findMany).not.toHaveBeenCalled();
    });

    it('set invalidates cache (calls redis.del)', async () => {
      (prisma.setting.upsert as jest.Mock).mockResolvedValue({});

      await service.set('site_name', 'New Name');

      expect(redis.del).toHaveBeenCalledWith(SETTINGS_BULK_KEY);
    });

    it('setJson invalidates cache via set', async () => {
      (prisma.setting.upsert as jest.Mock).mockResolvedValue({});

      await service.setJson('site_marquee', ['A', 'B']);

      expect(redis.del).toHaveBeenCalledWith(SETTINGS_BULK_KEY);
    });

    it('invalidate does not propagate error if redis.del fails', async () => {
      (prisma.setting.upsert as jest.Mock).mockResolvedValue({});
      redis.del.mockRejectedValue(new Error('Redis down'));

      await expect(service.set('k', 'v')).resolves.toBeUndefined();
      expect(prisma.setting.upsert).toHaveBeenCalled();
    });

    it('anti cache-stampede: concurrent requests on miss trigger 1 DB query', async () => {
      redis.getJson.mockResolvedValue(null);

      let resolveDB: (v: unknown) => void = () => { };
      const dbPromise = new Promise((res) => {
        resolveDB = res;
      });
      (prisma.setting.findMany as jest.Mock).mockReturnValue(dbPromise);

      const promises = [
        service.get('a'),
        service.get('b'),
        service.get('c'),
        service.get('d'),
        service.get('e'),
      ];

      resolveDB([{ key: 'a', value: '1' }]);
      await Promise.all(promises);

      expect(prisma.setting.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
