import { Controller, Get, Header } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { MetricsService } from './metrics.service';

@Roles('ADMIN')
@Controller('api/v1/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metrics.getMetrics();
  }
}
