import {
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  Max,
  Min,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuoteItemDto } from './create-quote-item.dto';

export class CreateCustomQuoteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName!: string;

  @IsEmail({}, { message: 'Invalid email' })
  @MaxLength(254)
  customerEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  customerNotes?: string;

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
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items?: CreateQuoteItemDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;
}
