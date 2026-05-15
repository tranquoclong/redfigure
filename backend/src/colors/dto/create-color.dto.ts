import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateColorDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name!: string;
}
