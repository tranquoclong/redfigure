import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, HttpHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheck: HealthCheckService;
  let prismaHealth: PrismaHealthIndicator;
  let redisHealth: RedisHealthIndicator;
  let httpHealth: HttpHealthIndicator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: PrismaHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
        {
          provide: RedisHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
        {
          provide: HttpHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheck = module.get<HealthCheckService>(HealthCheckService);
    prismaHealth = module.get<PrismaHealthIndicator>(PrismaHealthIndicator);
    redisHealth = module.get<RedisHealthIndicator>(RedisHealthIndicator);
    httpHealth = module.get<HttpHealthIndicator>(HttpHealthIndicator);
  });

  describe('GET /api/health (liveness)', () => {
    it('returns { status: ok } without touching any dependency', () => {
      const result = controller.liveness();
      expect(result).toEqual({ status: 'ok' });

      expect(healthCheck.check).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/health/ready (readiness)', () => {
    it('calls the 3 probes (Prisma, Redis, ES)', async () => {
      (healthCheck.check as jest.Mock).mockResolvedValue({
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          elasticsearch: { status: 'up' },
        },
        details: {},
      });

      const result = await controller.readiness();

      expect(healthCheck.check).toHaveBeenCalledTimes(1);

      const checksArray = (healthCheck.check as jest.Mock).mock.calls[0][0];
      expect(checksArray).toHaveLength(3);
      expect(result.status).toBe('ok');
    });

    it('returns 503 when some probe fails (delegated to Terminus)', async () => {

      (healthCheck.check as jest.Mock).mockRejectedValue(
        new Error('Service Unavailable'),
      );

      await expect(controller.readiness()).rejects.toThrow();
    });
  });
});

describe('PrismaHealthIndicator', () => {
  it('returns up when $queryRaw responds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const indicator = new PrismaHealthIndicator(prisma as never);

    const result = await indicator.isHealthy('database');

    expect(result).toEqual({ database: { status: 'up' } });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('throws HealthCheckError when $queryRaw rejects', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('PG down')),
    };
    const indicator = new PrismaHealthIndicator(prisma as never);

    await expect(indicator.isHealthy('database')).rejects.toThrow();
  });
});

describe('RedisHealthIndicator', () => {
  it('returns up when redis.ping() responds PONG', async () => {
    const redisClient = { ping: jest.fn().mockResolvedValue('PONG') };
    const redisService = { getClient: () => redisClient };
    const indicator = new RedisHealthIndicator(redisService as never);

    const result = await indicator.isHealthy('redis');

    expect(result).toEqual({ redis: { status: 'up' } });
    expect(redisClient.ping).toHaveBeenCalled();
  });

  it('throws HealthCheckError when ping fails', async () => {
    const redisClient = {
      ping: jest.fn().mockRejectedValue(new Error('Redis down')),
    };
    const redisService = { getClient: () => redisClient };
    const indicator = new RedisHealthIndicator(redisService as never);

    await expect(indicator.isHealthy('redis')).rejects.toThrow();
  });
});
