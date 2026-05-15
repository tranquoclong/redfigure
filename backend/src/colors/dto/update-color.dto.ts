import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateColorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;
}
