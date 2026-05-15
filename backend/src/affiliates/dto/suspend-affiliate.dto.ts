import { IsString, MinLength, MaxLength } from 'class-validator';

export class SuspendAffiliateDto {
  @IsString()
  @MinLength(5, { message: 'reason must be at least 5 characters' })
  @MaxLength(500)
  reason!: string;
}
