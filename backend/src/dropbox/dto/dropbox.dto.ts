import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const PATH_MAX = 1024;

export class DropboxPathsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(PATH_MAX, { each: true })
  paths!: string[];
}

export class UpdateDropboxSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  accessToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  refreshToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  appKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  appSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PATH_MAX)
  rootPath?: string;
}
