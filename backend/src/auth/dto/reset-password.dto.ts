import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  newPassword!: string;
}
