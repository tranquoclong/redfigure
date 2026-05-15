import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkMediaItemDto {
  @IsString()
  @Matches(/^c[a-z0-9]{20,29}$/, { message: 'id must be a valid cuid' })
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  captionPresetId?: string | null;
}

export class BulkUpdateMediaDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'items must contain at least 1 entry' })
  @ArrayMaxSize(100, { message: 'maximum of 100 items per bulk' })
  @ValidateNested({ each: true })
  @Type(() => BulkMediaItemDto)
  items!: BulkMediaItemDto[];
}
