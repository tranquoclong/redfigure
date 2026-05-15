import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StatsQueryDto {
  @Type(() => Date)
  @IsDate()
  dateFrom!: Date;

  @Type(() => Date)
  @IsDate()
  dateTo!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  affiliateId?: string;
}

export class TimeSeriesQueryDto extends StatsQueryDto {
  @IsOptional()
  @IsEnum(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month';
}

export class TopsQueryDto extends StatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
