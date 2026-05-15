import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAffiliateForUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  userId!: string;
}
