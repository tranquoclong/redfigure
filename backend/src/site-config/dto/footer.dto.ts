import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class FooterLinkDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(1)
  href!: string;
}

class FooterColumnDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterLinkDto)
  links!: FooterLinkDto[];
}

class FooterSocialDto {
  @IsIn(['instagram', 'facebook', 'twitter', 'youtube', 'tiktok'])
  platform!: 'instagram' | 'facebook' | 'twitter' | 'youtube' | 'tiktok';

  @IsString()
  @MinLength(1)
  href!: string;
}

class FooterLegalDto {
  @IsString()
  @MinLength(1)
  copyright!: string;

  @IsOptional()
  @IsString()
  mst?: string;
}

export class UpdateFooterDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterColumnDto)
  columns!: FooterColumnDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterSocialDto)
  socials!: FooterSocialDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => FooterLegalDto)
  legal!: FooterLegalDto;
}
