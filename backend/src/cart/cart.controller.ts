import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CartService } from './cart.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  AddCartItemDto,
  AddCartQuoteItemDto,
  UpdateCartItemDto,
} from './dto/cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateSessionIdOrThrow(sessionId: string | undefined): void {
  if (sessionId !== undefined && !UUID_V4_REGEX.test(sessionId)) {
    throw new BadRequestException('x-session-id header invalid');
  }
}

@Public()
@Controller('api/v1/cart')
export class CartController {
  constructor(private readonly cartService: CartService) { }

  private getCartKey(
    user: { id: string } | undefined,
    sessionId: string | undefined,
  ): string {
    if (user?.id) return user.id;
    if (sessionId) return `anonymous:${sessionId}`;
    throw new BadRequestException(
      'Either login or provide x-session-id header',
    );
  }

  @Get()
  async getCart(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId?: string,

    @Query('revalidate') revalidate?: string,
  ) {
    validateSessionIdOrThrow(sessionId);
    const key = this.getCartKey(user, sessionId);
    if (revalidate === 'true') {
      return { data: await this.cartService.getCartRevalidated(key) };
    }
    return { data: await this.cartService.getCart(key) };
  }

  @Post('clean-out-of-stock')

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async cleanOutOfStock(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    validateSessionIdOrThrow(sessionId);
    const key = this.getCartKey(user, sessionId);
    return { data: await this.cartService.cleanOutOfStock(key) };
  }

  @Post('items')

  @Throttle({ short: { limit: 30, ttl: 60000 } })
  async addItem(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Body() dto: AddCartItemDto,
  ) {
    validateSessionIdOrThrow(sessionId);
    const key = this.getCartKey(user, sessionId);
    return { data: await this.cartService.addItem(key, dto) };
  }

  @Post('items/quote')
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  async addQuoteItem(
    @CurrentUser() user: { id: string; email?: string } | undefined,
    @Body() dto: AddCartQuoteItemDto,
  ) {
    if (!user?.id || !user?.email) {
      throw new BadRequestException(
        'Login required to add quote items',
      );
    }
    return {
      data: await this.cartService.addQuoteItem(
        user.id,
        user.email,
        dto.quoteItemId,
        dto.quantity,
      ),
    };
  }

  @Delete('items/quote/:quoteItemId')
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  async removeQuoteItem(
    @CurrentUser() user: { id: string } | undefined,
    @Param('quoteItemId') quoteItemId: string,
  ) {
    if (!user?.id) {
      throw new BadRequestException(
        'Login required to remove quote items',
      );
    }
    return {
      data: await this.cartService.removeQuoteItem(user.id, quoteItemId),
    };
  }

  @Put('items/:productId')
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  async updateQuantity(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
    @Query('variationId') variationId?: string,
    @Query('scaleId') scaleId?: string,
  ) {
    validateSessionIdOrThrow(sessionId);
    const key = this.getCartKey(user, sessionId);
    return {
      data: await this.cartService.updateQuantity(
        key,
        productId,
        dto.quantity,
        variationId,
        scaleId,
      ),
    };
  }

  @Delete('items/:productId')
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  async removeItem(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('productId') productId: string,
    @Query('variationId') variationId?: string,
    @Query('scaleId') scaleId?: string,
  ) {
    validateSessionIdOrThrow(sessionId);
    const key = this.getCartKey(user, sessionId);
    return {
      data: await this.cartService.removeItem(
        key,
        productId,
        variationId,
        scaleId,
      ),
    };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clear(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    validateSessionIdOrThrow(sessionId);
    const key = this.getCartKey(user, sessionId);
    await this.cartService.clear(key);
    return { data: { message: 'Cart cleared' } };
  }

  @Post('merge')

  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async mergeCart(
    @CurrentUser() user: { id: string },
    @Body() dto: MergeCartDto,
  ) {
    if (!user?.id) return { data: { merged: false } };
    const anonKey = `anonymous:${dto.sessionId}`;
    const anonCart = await this.cartService.getCart(anonKey);

    if (anonCart.items.length > 0) {
      for (const item of anonCart.items) {

        if (!item.productId) continue;
        await this.cartService.addItem(user.id, {
          productId: item.productId,
          variationId: item.variationId,
          scaleId: item.scaleId,
          quantity: item.quantity,
        });
      }
      await this.cartService.clear(anonKey);
    }

    const userCart = await this.cartService.getCart(user.id);
    return { data: { merged: true, cart: userCart } };
  }
}
