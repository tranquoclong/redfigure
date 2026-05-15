import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';

export class RequestCustomQuoteDto {

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email' })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true, message: 'Invalid link' })
  externalLinks?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  imageMediaFileIds?: string[];

  @IsString()
  @MaxLength(2000)
  turnstileToken!: string;

  @IsBoolean()
  acceptLgpd!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export const HONEYPOT_FIELD = 'website' as const;
