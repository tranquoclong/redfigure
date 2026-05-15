import {
  Module,
  MiddlewareConsumer,
  NestModule,
  ExecutionContext,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { SentryModule } from '@sentry/nestjs/setup';
import { PINO_REDACT_OPTIONS } from './common/utils/log-redact';
import { isInternalRequest } from './common/utils/is-internal-request';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  mailConfig,
  storageConfig,
} from './config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { BrandsModule } from './brands/brands.module';
import { ScalesModule } from './scales/scales.module';
import { ProductsModule } from './products/products.module';
import { CouponsModule } from './coupons/coupons.module';
import { FreeGiftsModule } from './free-gifts/free-gifts.module';
import { CartModule } from './cart/cart.module';
import { CartAbandonmentModule } from './cart-abandonment/cart-abandonment.module';
import { OrdersModule } from './orders/orders.module';
import { BundlesModule } from './bundles/bundles.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { EmailModule } from './email/email.module';
import { AdminModule } from './admin/admin.module';
import { SearchModule } from './search/search.module';
import { MediaModule } from './media/media.module';
import { SeoModule } from './seo/seo.module';
import { BlogModule } from './blog/blog.module';
import { PagesModule } from './pages/pages.module';
import { AttributesModule } from './attributes/attributes.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReviewInvitesModule } from './review-invites/review-invites.module';
import { StockModule } from './stock/stock.module';
import { HolidaysModule } from './holidays/holidays.module';
import { FeedModule } from './feed/feed.module';
import { ColorsModule } from './colors/colors.module';
import { MaterialsModule } from './materials/materials.module';
import { GoogleCategoriesModule } from './google-categories/google-categories.module';
import { SettingsModule } from './settings/settings.module';
import { SiteConfigModule } from './site-config/site-config.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { BannersModule } from './banners/banners.module';
import { FeaturedCategoriesModule } from './featured-categories/featured-categories.module';
import { RecentlyViewedModule } from './recently-viewed/recently-viewed.module';
import { DropboxModule } from './dropbox/dropbox.module';
import { SecurityModule } from './security/security.module';
import { TurnstileModule } from './turnstile/turnstile.module';
import { ContactModule } from './contact/contact.module';
import { ProductQuestionsModule } from './product-questions/product-questions.module';
import { CustomQuotesModule } from './custom-quotes/custom-quotes.module';
import { AffiliatesModule } from './affiliates/affiliates.module';
import { SecurityMiddleware } from './security/security.middleware';
import { CloudflareIpMiddleware } from './common/middleware/cloudflare-ip.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { ObservabilityModule } from './observability/observability.module';
import { MetricsModule } from './metrics/metrics.module';
import { CleanupModule } from './cleanup/cleanup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, mailConfig, storageConfig],
    }),

    SentryModule.forRoot(),

    ScheduleModule.forRoot(),

    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env.LOG_LEVEL ||
          (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
        autoLogging: false,
        redact: PINO_REDACT_OPTIONS,
        transport:
          process.env.NODE_ENV === 'development'
            ? {
              target: 'pino-pretty',
              options: { colorize: true, singleLine: true },
            }
            : undefined,

        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 3 },
        { name: 'medium', ttl: 10000, limit: 20 },
        { name: 'long', ttl: 60000, limit: 100 },
      ],

      skipIf: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest();
        return isInternalRequest(req.headers ?? {});
      },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    ObservabilityModule,
    MetricsModule,

    AuthModule,
    UsersModule,
    AddressesModule,

    CategoriesModule,
    TagsModule,
    BrandsModule,
    ScalesModule,
    ProductsModule,

    CouponsModule,
    FreeGiftsModule,
    CartModule,
    CartAbandonmentModule,
    OrdersModule,
    HolidaysModule,
    BundlesModule,

    WishlistModule,
    RecentlyViewedModule,
    EmailModule,

    AdminModule,

    SearchModule,
    MediaModule,
    SeoModule,
    BlogModule,
    PagesModule,
    AttributesModule,
    ReviewsModule,
    ReviewInvitesModule,
    StockModule,
    FeedModule,
    ColorsModule,
    MaterialsModule,
    GoogleCategoriesModule,

    DropboxModule,

    SettingsModule,
    SiteConfigModule,
    NewsletterModule,
    BannersModule,
    FeaturedCategoriesModule,

    SecurityModule,

    TurnstileModule,
    ContactModule,

    ProductQuestionsModule,

    CustomQuotesModule,

    AffiliatesModule,

    CleanupModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CloudflareIpMiddleware,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {

    consumer.apply(CloudflareIpMiddleware).forRoutes('*');

    consumer.apply(SecurityMiddleware).forRoutes('api/v1/auth');
  }
}
