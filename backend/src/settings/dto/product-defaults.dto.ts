import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ALLOWED_CONDITIONS = ['new', 'used', 'refurbished'];

export class UpdateProductDefaultsDto {

  @IsOptional()
  @IsString()
  @MaxLength(20)
  weight?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  width?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  height?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  length?: string;

  @IsOptional()
  @IsIn(ALLOWED_CONDITIONS)
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  colorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  materialId?: string;
}
