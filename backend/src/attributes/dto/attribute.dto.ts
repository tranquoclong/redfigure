import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAttributeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

export class UpdateAttributeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}

export class CreateAttributeValueDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  value!: string;
}
