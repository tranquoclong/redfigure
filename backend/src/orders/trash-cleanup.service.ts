import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const TRASH_RETENTION_DAYS = 30;

@Injectable()
export class TrashCleanupService {
  private readonly logger = new Logger(TrashCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async processCleanup(): Promise<void> {
    const cutoff = new Date(
      Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const expired = await this.prisma.order.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    });

    if (expired.length === 0) {
      this.logger.log('Trash cleanup: no expired orders to delete');
      return;
    }

    this.logger.log(
      `Trash cleanup: deleting ${expired.length} expired order(s)`,
    );

    let deleted = 0;
    let failed = 0;
    for (const { id } of expired) {
      try {
        await this.prisma.order.delete({ where: { id } });
        deleted++;
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed to hard delete order ${id}: ${err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(`Trash cleanup done: ${deleted} deleted, ${failed} failed`);
  }
}
