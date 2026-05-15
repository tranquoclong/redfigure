import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CommissionRuleScope } from '@prisma/client';

export class CreateCommissionRuleDto {
  @IsEnum(CommissionRuleScope)
  scope!: CommissionRuleScope;

  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
