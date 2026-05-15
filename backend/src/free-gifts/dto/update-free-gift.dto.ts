import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const CUID_REGEX = /^c[a-z0-9]{20,29}$/;

export class UpdateFreeGiftDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  minOrderAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(CUID_REGEX, { message: 'Invalid productId' })
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
