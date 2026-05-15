import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraDays?: number;

  @IsOptional()
  @IsString()
  scaleRuleSetId?: string;

  @IsOptional()
  @IsString()
  colorId?: string;

  @IsOptional()
  @IsString()
  materialId?: string;

  @IsOptional()
  @IsString()
  googleCategoryId?: string;
}
