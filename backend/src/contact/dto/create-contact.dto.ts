import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Invalid email' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

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
