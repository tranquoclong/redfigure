import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AddCartItemDto {
  @IsString()
  @MaxLength(40)
  productId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  variationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  scaleId?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(0)
  @Max(100)
  quantity!: number;
}

export class AddCartQuoteItemDto {
  @IsString()
  @MaxLength(40)
  quoteItemId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}
