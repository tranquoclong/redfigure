import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';

export class CreateQuoteItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  unitPrice!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxQuantity?: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  @Max(30)
  weight!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(200)
  width!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(200)
  height!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(200)
  lengthCm!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
