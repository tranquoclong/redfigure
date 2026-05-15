import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  extraDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  scaleRuleSetId?: string;

  @IsOptional()
  @IsBoolean()
  noScales?: boolean;
}

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  extraDays?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  scaleRuleSetId?: string | null;

  @IsOptional()
  @IsBoolean()
  noScales?: boolean;
}
