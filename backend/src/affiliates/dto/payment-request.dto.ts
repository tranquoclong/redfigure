import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordPaymentDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999.99)
  amount!: number;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentRequestId?: string;
}

export class CancelPaymentRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
