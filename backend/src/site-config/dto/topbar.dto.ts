import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TopBarMessageDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsIn(['left', 'right'])
  align!: 'left' | 'right';
}

export class UpdateTopBarDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TopBarMessageDto)
  messages!: TopBarMessageDto[];
}
