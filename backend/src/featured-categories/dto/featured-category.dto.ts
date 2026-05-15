import { PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFeaturedCategoryDto {
  @IsString()
  categoryId!: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'glowColor must be hex (#fff or #ffffff)',
  })
  glowColor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFeaturedCategoryDto extends PartialType(
  CreateFeaturedCategoryDto,
) { }

class ReorderItemDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderFeaturedCategoriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
