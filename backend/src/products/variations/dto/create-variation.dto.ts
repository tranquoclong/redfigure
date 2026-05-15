import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVariationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  scaleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
