import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(40)
  name?: string;
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  street?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  ward?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  province?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
