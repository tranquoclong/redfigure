import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]*$/, { message: 'skuPrefix must be A-Z 0-9 -' })
  skuPrefix?: string;

  @IsOptional()
  @IsBoolean()
  renameFolderDefault?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  scaleRuleSetId?: string | null;

  @IsOptional()
  @IsBoolean()
  noScales?: boolean;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]*$/, { message: 'skuPrefix must be A-Z 0-9 -' })
  skuPrefix?: string;

  @IsOptional()
  @IsBoolean()
  renameFolderDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  skuCounter?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  scaleRuleSetId?: string | null;

  @IsOptional()
  @IsBoolean()
  noScales?: boolean;
}
