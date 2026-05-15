import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class LinkDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(1)
  href!: string;
}

class ColumnDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkDto)
  links!: LinkDto[];
}

class FeaturedImageDto {
  @IsString()
  url!: string;

  @IsString()
  href!: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

class MegaMenuItemDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(1)
  href!: string;

  @IsOptional()
  @IsIn(['NEW', 'HOT', 'SALE'])
  badge?: 'NEW' | 'HOT' | 'SALE';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnDto)
  columns?: ColumnDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FeaturedImageDto)
  featuredImage?: FeaturedImageDto;
}

export class UpdateMegaMenuDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MegaMenuItemDto)
  items!: MegaMenuItemDto[];
}
