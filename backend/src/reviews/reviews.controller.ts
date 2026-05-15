import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReviewsService } from './reviews.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { HighlightReviewDto } from './dto/highlight-review.dto';

@Controller('api/v1')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reviews')

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateReviewDto,
  ) {
    return await this.reviewsService.create({ userId: user.id, ...dto });
  }

  @Public()
  @Get('products/:productId/reviews')
  async findByProduct(@Param('productId') productId: string) {

    const [reviews, rating, distribution] = await Promise.all([
      this.reviewsService.findByProduct(productId),
      this.reviewsService.getAverageRating(productId),
      this.reviewsService.getRatingDistribution(productId),
    ]);
    return { reviews, ...rating, distribution };
  }

  @Roles('ADMIN')
  @Get('reviews/admin')
  async findAllAdmin() {
    return await this.reviewsService.findAllAdmin();
  }

  @Roles('ADMIN')
  @Put('reviews/:id/approve')
  async approve(@Param('id') id: string) {

    const hasReward = await this.reviewsService.hasExistingReward(id);
    const review = await this.reviewsService.approve(id);

    if (hasReward) {
      return { review, reward: null, alreadyRewarded: true };
    }

    const reward = await this.reviewsService.generateReward(id, review.userId);
    return { review, reward };
  }

  @Public()
  @Get('reviews/highlighted')
  async findHighlighted(@Query('limit') limitRaw?: string) {
    const limit = limitRaw ? parseInt(limitRaw, 10) : 3;
    return {
      data: await this.reviewsService.findHighlighted({
        limit: Number.isFinite(limit) ? limit : 3,
      }),
    };
  }

  @Roles('ADMIN')
  @Patch('reviews/:id/highlight')
  async setHighlighted(
    @Param('id') id: string,
    @Body() dto: HighlightReviewDto,
  ) {
    return {
      data: await this.reviewsService.setHighlightedOnHome(
        id,
        dto.isHighlighted,
      ),
    };
  }
}
