import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';

export class BulkDeleteOrphansDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^c[a-z0-9]{20,29}$/, { each: true, message: 'invalid id format' })
  ids!: string[];
}
