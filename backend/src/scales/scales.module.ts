import { Module } from '@nestjs/common';
import { ScalesController } from './scales.controller';
import { ScalesService } from './scales.service';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [CategoriesModule],
  controllers: [ScalesController],
  providers: [ScalesService],
  exports: [ScalesService],
})
export class ScalesModule {}
