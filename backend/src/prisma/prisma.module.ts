import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { softDeleteExtension } from './soft-delete.extension';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async (metrics: MetricsService) => {
        const base = new PrismaService(metrics);

        await base.$connect();

        return base.$extends(softDeleteExtension);
      },
      inject: [MetricsService],
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
