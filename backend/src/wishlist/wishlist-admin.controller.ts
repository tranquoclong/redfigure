import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { WishlistService } from './wishlist.service';

@Controller('api/v1/admin/wishlist')

@Throttle({ short: { limit: 60, ttl: 60000 } })
export class WishlistAdminController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Roles('ADMIN')
  @Get('users/:userId')
  async getWishlistByUser(@Param('userId', ParseCuidPipe) userId: string) {
    const items = await this.wishlistService.findAllForAdmin(userId);
    return { data: items };
  }
}
