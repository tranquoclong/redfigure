import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class UpdateMarqueeDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  items!: string[];
}
