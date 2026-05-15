import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraDays?: number;

  @IsOptional()
  @IsString()
  scaleRuleSetId?: string | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  colorId?: string | null;

  @IsOptional()
  @IsString()
  materialId?: string | null;

  @IsOptional()
  @IsString()
  googleCategoryId?: string | null;
}
