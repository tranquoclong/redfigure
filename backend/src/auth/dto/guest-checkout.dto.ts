import { IsBoolean, IsEmail, IsOptional, MaxLength } from 'class-validator';

export class GuestCheckoutDto {

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
