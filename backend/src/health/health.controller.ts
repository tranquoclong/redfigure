import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly httpHealth: HttpHealthIndicator,
  ) { }

  @Public()
  @Get()
  liveness(): { status: string } {

    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  async readiness() {

    const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
      () =>
        this.httpHealth.pingCheck('elasticsearch', `${esUrl}/_cluster/health`, {
          timeout: 2000,
        }),
    ]);
  }
}
