import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  Max,
  Min,
  ArrayMaxSize,
} from 'class-validator';

export class UpdateCustomQuoteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNotes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  externalLinks?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;
}
