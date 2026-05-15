import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { LIMITS } from './home-blocks.types';

export class HomeBlockInputDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsInt()
  order!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsObject()
  data!: Record<string, unknown>;
}

export class SetHomeBlocksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITS.maxBlocks)
  @ValidateNested({ each: true })
  @Type(() => HomeBlockInputDto)
  blocks!: HomeBlockInputDto[];
}
