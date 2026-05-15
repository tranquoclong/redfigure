import { Module } from '@nestjs/common';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';
import { AttributeMatcherService } from './attribute-matcher.service';

@Module({
  controllers: [AttributesController],
  providers: [AttributesService, AttributeMatcherService],
  exports: [AttributesService, AttributeMatcherService],
})
export class AttributesModule {}
