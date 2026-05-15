import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { CartService } from './cart.service';

@Controller('api/v1/admin/cart')
@Throttle({ short: { limit: 60, ttl: 60000 } })
export class CartAdminController {
  constructor(private readonly cartService: CartService) {}

  @Roles('ADMIN')
  @Get('users/:userId')
  async getCartByUser(@Param('userId', ParseCuidPipe) userId: string) {
    const cart = await this.cartService.getPersistedCartForUser(userId);
    return { data: cart };
  }
}
