import { IsString, MinLength } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  date!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}
