import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class AiGenerateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  brandId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  collectionValueId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mediaFileIds?: string;
}
