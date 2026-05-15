import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
  IsDateString,
  Min,
  MinLength,
  MaxLength,
  IsIn,
  ValidateIf,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @ValidateIf(
    (o: CreateProductDto) => !o.isDraft || o.description !== undefined,
  )
  @IsString()
  @IsNotEmpty({ message: 'Description is required to publish' })
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

  @ValidateIf((o: CreateProductDto) => !o.isDraft || o.basePrice !== undefined)
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price cannot be negative' })
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  salePrice?: number;

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
  colorId?: string;

  @IsOptional()
  @IsString()
  materialId?: string;

  @IsOptional()
  @IsString()
  googleCategoryId?: string;

  @IsOptional()
  @IsDateString()
  salePriceStartDate?: string;

  @IsOptional()
  @IsDateString()
  salePriceEndDate?: string;

  @IsOptional()
  @IsBoolean()
  manageStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  weight?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  width?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  height?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  length?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraDays?: number;

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
  @IsArray()
  variations?: Array<{
    name: string;
    sku?: string;
    gtin?: string;
    price: number;
    salePrice?: number;
    manageStock?: boolean;
    stock?: number;
    weight?: number;
    width?: number;
    height?: number;
    length?: number;
    image?: string;
    images?: Array<{ mediaFileId: string; isMain: boolean; order: number }>;
    scaleId?: string;
    attributeValueId?: string;
  }>;

  @IsOptional()
  @IsString()
  scaleRuleSetId?: string;

  @IsOptional()
  @IsBoolean()
  noScales?: boolean;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  dropboxFolderPath?: string;

  @IsOptional()
  @IsBoolean()
  renameDropboxFolder?: boolean;
}
