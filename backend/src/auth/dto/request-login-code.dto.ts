import { IsEmail, IsIn, IsOptional, MaxLength } from 'class-validator';

export class RequestLoginCodeDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsIn(['LOGIN', 'CLAIM'])
  purpose?: 'LOGIN' | 'CLAIM';
}
