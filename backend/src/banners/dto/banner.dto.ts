import { PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eyebrow?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryCtaLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  primaryCtaHref?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  secondaryCtaLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  secondaryCtaHref?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}

export class ReorderItemDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderBannersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
