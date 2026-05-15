import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LedgerAdjustmentDto {
  @IsEnum(['CREDIT', 'DEBIT'], {
    message: 'type deve ser CREDIT ou DEBIT',
  })
  type!: 'CREDIT' | 'DEBIT';

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999.99)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
