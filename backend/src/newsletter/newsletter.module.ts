import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { AdminNewsletterController } from './admin-newsletter.controller';

@Module({
  providers: [NewsletterService],
  controllers: [NewsletterController, AdminNewsletterController],
  exports: [NewsletterService],
})
export class NewsletterModule {}
