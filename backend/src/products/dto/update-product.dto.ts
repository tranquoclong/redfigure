import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  IsDateString,
  Min,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['simple', 'variable', 'bundle'])
  type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bundleDiscount?: number;

  @IsOptional()
  @IsArray()
  bundleComponents?: Array<{
    childProductId: string;
    childVariationId?: string;
    quantity: number;
    sortOrder?: number;
  }>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  salePrice?: number | null;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  gtin?: string;

  @IsOptional()
  @IsString()
  mpn?: string;

  @IsOptional()
  @IsString()
  @IsIn(['new', 'refurbished', 'used'])
  condition?: string;

  @IsOptional()
  @IsString()
  colorId?: string | null;

  @IsOptional()
  @IsString()
  materialId?: string | null;

  @IsOptional()
  @IsString()
  googleCategoryId?: string | null;

  @IsOptional()
  @IsDateString()
  salePriceStartDate?: string | null;

  @IsOptional()
  @IsDateString()
  salePriceEndDate?: string | null;

  @IsOptional()
  @IsBoolean()
  manageStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  stockAdjustmentNote?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  length?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraDays?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsString()
  primaryCategoryId?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attributeValueIds?: string[];

  @IsOptional()
  @IsArray()
  images?: Array<{
    mediaFileId: string;
    isMain: boolean;
    order: number;
  }>;

  @IsOptional()
  @IsString()
  scaleRuleSetId?: string | null;

  @IsOptional()
  @IsBoolean()
  noScales?: boolean;

  @IsOptional()
  @IsArray()
  variations?: Array<{
    id?: string;
    name: string;
    sku?: string;
    gtin?: string;
    price: number;
    salePrice?: number | null;
    manageStock?: boolean;
    stock?: number;
    weight?: number;
    width?: number;
    height?: number;
    length?: number;
    image?: string;
    images?: Array<{ mediaFileId: string; isMain: boolean; order: number }>;
    scaleId?: string;
    attributeValueId?: string | null;
  }>;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
