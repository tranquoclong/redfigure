import {
  IsBoolean,
  IsEmail,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator';

export class VerifyLoginCodeDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits' })
  code!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
