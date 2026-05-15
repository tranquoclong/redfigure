import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const ALLOWED_ENTITY_TYPES = [
  'product',
  'category',
  'brand',
  'tag',
  'page',
  'blog',
];

export class UpsertSeoMetaDto {
  @IsIn(ALLOWED_ENTITY_TYPES, {
    message: `entityType must be one of: ${ALLOWED_ENTITY_TYPES.join(', ')}`,
  })
  entityType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  entityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ogImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  keywords?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  canonical?: string;
}
