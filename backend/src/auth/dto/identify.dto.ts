import { IsEmail, MaxLength } from 'class-validator';

export class IdentifyDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
