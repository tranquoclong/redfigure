import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsUUID } from 'class-validator';
import { RecentlyViewedService } from './recently-viewed.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateSessionIdOrThrow(sessionId: string | undefined): void {
  if (sessionId !== undefined && !UUID_V4_REGEX.test(sessionId)) {
    throw new BadRequestException('x-session-id header invalid');
  }
}

class MergeRecentlyViewedDto {
  @IsUUID(4)
  sessionId!: string;
}

@Controller('api/v1/recently-viewed')
export class RecentlyViewedController {
  constructor(
    private readonly recentlyViewedService: RecentlyViewedService,
    private readonly prisma: PrismaService,
  ) { }

  @Public()
  @Get()
  @Throttle({ short: { limit: 60, ttl: 60000 } })
  async getRecentlyViewed(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
  ) {
    validateSessionIdOrThrow(sessionId);
    const owner = this.recentlyViewedService.resolveOwner(user?.id, sessionId);
    const ids = await this.recentlyViewedService.getViewed(
      owner.userId,
      owner.sessionId,
    );
    if (ids.length === 0) return { data: [] };
    return { data: await this.hydrateProducts(ids) };
  }

  @Roles('ADMIN')
  @Throttle({ short: { limit: 60, ttl: 60000 } })
  @Get('user/:userId')
  async getAdminUserViewed(@Param('userId', ParseCuidPipe) userId: string) {
    const ids = await this.recentlyViewedService.getViewedByUserId(userId);
    if (ids.length === 0) return { data: [] };
    return { data: await this.hydrateProducts(ids) };
  }

  @Post('merge')

  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async mergeViewed(
    @CurrentUser() user: { id: string },
    @Body() dto: MergeRecentlyViewedDto,
  ) {
    if (!user?.id) return { data: { merged: false } };
    await this.recentlyViewedService.merge(user.id, dto.sessionId);
    return { data: { merged: true } };
  }

  @Public()
  @Post(':productId')

  @Throttle({ short: { limit: 60, ttl: 60000 } })
  async recordView(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('productId') productId: string,
  ) {
    validateSessionIdOrThrow(sessionId);
    const owner = this.recentlyViewedService.resolveOwner(user?.id, sessionId);
    await this.recentlyViewedService.recordView(
      owner.userId,
      owner.sessionId,
      productId,
    );
    return { data: { recorded: true } };
  }

  private async hydrateProducts(ids: string[]) {
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        isDraft: false,
      },
      include: {
        images: {
          include: { mediaFile: true },
          where: { isMain: true },
          take: 1,
        },
        variations: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            price: true,
            salePrice: true,
            manageStock: true,
            stock: true,
          },
        },
        productCategories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
          where: { isPrimary: true },
          take: 1,
        },
      },
      // take: 4,
    });

    const map = new Map(products.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }
}
