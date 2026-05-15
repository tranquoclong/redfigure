import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProductQuestionDto {
  @IsString()
  @MaxLength(40)
  productId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  question!: string;

  @IsBoolean()
  acceptLgpd!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  askerName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email' })
  @MaxLength(254)
  askerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  turnstileToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
