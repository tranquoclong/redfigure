import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const MAX_DELTA = 10_000;

export class AdjustStockDto {
  @IsInt({ message: 'delta must be an integer' })
  @Min(-MAX_DELTA, {
    message: `delta min: -${MAX_DELTA}`,
  })
  @Max(MAX_DELTA, {
    message: `delta max: ${MAX_DELTA}`,
  })
  delta!: number;

  @IsOptional()
  @IsString()
  variationId?: string;
}
