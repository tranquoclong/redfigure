import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(40)
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'postalCode must be exactly 8 digits' })
  postalCode?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  street!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(80)
  ward!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(80)
  district!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(80)
  province!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
