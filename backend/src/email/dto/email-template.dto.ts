import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const NO_CONTROL_CHARS = /^[^\r\n\x00]*$/;

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Matches(NO_CONTROL_CHARS, { message: 'subject contains control chars' })
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  htmlBody?: string;
}

export class SendTestEmailDto {
  @IsEmail()
  @MaxLength(254)

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(NO_CONTROL_CHARS, { message: 'subject contains control chars' })
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  htmlBody?: string;
}
