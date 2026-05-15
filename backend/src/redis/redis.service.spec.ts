import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
      hset: jest.fn(),
      hget: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      incr: jest.fn(),
      ttl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  describe('basic key-value operations', () => {
    it('should set a value with TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('key1', 'value1', 3600);

      expect(mockRedis.set).toHaveBeenCalledWith('key1', 'value1', 'EX', 3600);
    });

    it('should set a value without TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('key1', 'value1');

      expect(mockRedis.set).toHaveBeenCalledWith('key1', 'value1');
    });

    it('should get a value', async () => {
      mockRedis.get.mockResolvedValue('value1');

      const result = await service.get('key1');

      expect(result).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.del('key1');

      expect(mockRedis.del).toHaveBeenCalledWith('key1');
    });
  });

  describe('JSON operations', () => {
    it('should set and get JSON objects', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const obj = { name: 'test', items: [1, 2, 3] };

      await service.setJson('obj1', obj, 600);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'obj1',
        JSON.stringify(obj),
        'EX',
        600,
      );
    });

    it('should get and parse JSON objects', async () => {
      const obj = { name: 'test', items: [1, 2, 3] };
      mockRedis.get.mockResolvedValue(JSON.stringify(obj));

      const result = await service.getJson('obj1');

      expect(result).toEqual(obj);
    });

    it('should return null for non-existent JSON key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getJson('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('hash operations', () => {
    it('should set a hash field', async () => {
      mockRedis.hset.mockResolvedValue(1);

      await service.hset('hash1', 'field1', 'value1');

      expect(mockRedis.hset).toHaveBeenCalledWith('hash1', 'field1', 'value1');
    });

    it('should get a hash field', async () => {
      mockRedis.hget.mockResolvedValue('value1');

      const result = await service.hget('hash1', 'field1');

      expect(result).toBe('value1');
    });

    it('should get all hash fields', async () => {
      mockRedis.hgetall.mockResolvedValue({ f1: 'v1', f2: 'v2' });

      const result = await service.hgetall('hash1');

      expect(result).toEqual({ f1: 'v1', f2: 'v2' });
    });
  });

  describe('utility operations', () => {
    it('should check key existence', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists('key1');

      expect(result).toBe(true);
    });

    it('should set TTL on existing key', async () => {
      mockRedis.expire.mockResolvedValue(1);

      await service.expire('key1', 3600);

      expect(mockRedis.expire).toHaveBeenCalledWith('key1', 3600);
    });

    it('should find keys by pattern', async () => {
      mockRedis.keys.mockResolvedValue(['cart:user1', 'cart:user2']);

      const result = await service.keys('cart:*');

      expect(result).toEqual(['cart:user1', 'cart:user2']);
    });

    it('should increment a counter', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const result = await service.incr('counter');

      expect(result).toBe(5);
    });
  });
});
