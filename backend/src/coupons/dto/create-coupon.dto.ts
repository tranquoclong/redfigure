import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsIn(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING'])
  type!: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';

  @IsNumber()
  @IsPositive()
  value!: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  minOrderValue?: number;

  @IsOptional()
  @IsInt()
  maxUses?: number;

  @IsOptional()
  @IsInt()
  usesPerUser?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: Date;

  @IsOptional()
  @IsDateString()
  validUntil?: Date;

  @IsOptional()
  @IsBoolean()
  isFirstPurchaseOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isFreeShipping?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  affiliateId?: string;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  stackableWithIds?: string[];
}
