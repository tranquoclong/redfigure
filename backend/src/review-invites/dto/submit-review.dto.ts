import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SiteReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ProductReviewDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  mediaFileIds?: string[];
}

export class SubmitReviewDto {
  @ValidateNested()
  @Type(() => SiteReviewDto)
  site!: SiteReviewDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((p: ProductReviewDto) => p.productId)
  @ValidateNested({ each: true })
  @Type(() => ProductReviewDto)
  products!: ProductReviewDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
