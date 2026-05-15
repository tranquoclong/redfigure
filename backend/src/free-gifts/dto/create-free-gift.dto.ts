import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const CUID_REGEX = /^c[a-z0-9]{20,29}$/;

export class CreateFreeGiftDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  minOrderAmount!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(CUID_REGEX, { message: 'Invalid productId' })
  productId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
