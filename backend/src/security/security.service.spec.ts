import { Test, TestingModule } from '@nestjs/testing';
import { SecurityService } from './security.service';
import { RedisService } from '../redis/redis.service';

describe('SecurityService', () => {
  let service: SecurityService;
  let redis: any;

  const store: Record<string, { value: string; ttl?: number }> = {};

  beforeEach(async () => {

    Object.keys(store).forEach((k) => delete store[k]);

    redis = {
      incr: jest.fn().mockImplementation((key: string) => {
        const current = store[key]?.value ? parseInt(store[key].value, 10) : 0;
        const next = current + 1;
        store[key] = { value: String(next), ttl: store[key]?.ttl };
        return Promise.resolve(next);
      }),
      expire: jest.fn().mockResolvedValue(undefined),
      set: jest
        .fn()
        .mockImplementation(
          (key: string, value: string, _ex?: string, ttl?: number) => {
            store[key] = { value, ttl };
            return Promise.resolve('OK');
          },
        ),
      setJson: jest
        .fn()
        .mockImplementation((key: string, value: unknown, ttl?: number) => {
          store[key] = { value: JSON.stringify(value), ttl };
          return Promise.resolve();
        }),
      get: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(store[key]?.value ?? null);
      }),
      getJson: jest.fn().mockImplementation((key: string) => {
        const raw = store[key]?.value;
        return Promise.resolve(raw ? JSON.parse(raw) : null);
      }),
      del: jest.fn().mockImplementation((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      keys: jest.fn().mockImplementation((pattern: string) => {
        const prefix = pattern.replaceAll('*', '');
        return Promise.resolve(
          Object.keys(store).filter((k) => k.startsWith(prefix)),
        );
      }),
      ttl: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(store[key]?.ttl ?? -1);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SecurityService, { provide: RedisService, useValue: redis }],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
  });

  describe('recordFailedAttempt', () => {
    it('should increment counter and return false below threshold', async () => {
      const banned = await service.recordFailedAttempt(
        '1.2.3.4',
        'login failed',
      );

      expect(banned).toBe(false);
      expect(redis.incr).toHaveBeenCalled();
    });

    it('should auto-ban after 10 failed attempts', async () => {

      store['security:attempts:1.2.3.4'] = { value: '9' };

      const banned = await service.recordFailedAttempt(
        '1.2.3.4',
        'login failed',
      );

      expect(banned).toBe(true);
    });

    it('should log the attempt', async () => {
      await service.recordFailedAttempt('1.2.3.4', 'bad token', 'Mozilla/5.0');

      expect(redis.setJson).toHaveBeenCalledWith(
        'security:log:recent',
        expect.arrayContaining([
          expect.objectContaining({
            ip: '1.2.3.4',
            reason: 'bad token',
            userAgent: 'Mozilla/5.0',
          }),
        ]),
        86400,
      );
    });
  });

  describe('banIp / isBanned', () => {
    it('should ban an IP and detect it as banned', async () => {
      await service.banIp('5.6.7.8', 'brute force');

      const ban = await service.isBanned('5.6.7.8');

      expect(ban).not.toBeNull();
      expect(ban!.ip).toBe('5.6.7.8');
      expect(ban!.reason).toContain('brute force');
    });

    it('should return null for non-banned IP', async () => {
      const ban = await service.isBanned('9.9.9.9');

      expect(ban).toBeNull();
    });
  });

  describe('unbanIp', () => {
    it('should remove ban and attempts counter', async () => {
      await service.banIp('5.6.7.8', 'test');

      await service.unbanIp('5.6.7.8');

      const ban = await service.isBanned('5.6.7.8');
      expect(ban).toBeNull();
      expect(redis.del).toHaveBeenCalledWith('security:ban:5.6.7.8');
      expect(redis.del).toHaveBeenCalledWith('security:attempts:5.6.7.8');
    });
  });

  describe('listBans', () => {
    it('should return all banned IPs', async () => {
      await service.banIp('1.1.1.1', 'reason A');
      await service.banIp('2.2.2.2', 'reason B');

      const bans = await service.listBans();

      expect(bans).toHaveLength(2);
      expect(bans.map((b) => b.ip)).toEqual(
        expect.arrayContaining(['1.1.1.1', '2.2.2.2']),
      );
    });
  });

  describe('getRecentAttempts', () => {
    it('should return logged attempts', async () => {
      await service.recordFailedAttempt('1.2.3.4', 'bad password');
      await service.recordFailedAttempt('5.6.7.8', 'bad token');

      const attempts = await service.getRecentAttempts();

      expect(attempts.length).toBeGreaterThanOrEqual(2);
      expect(attempts[0].ip).toBe('5.6.7.8');
      expect(attempts[1].ip).toBe('1.2.3.4');
    });
  });
});
