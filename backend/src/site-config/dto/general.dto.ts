import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateGeneralDto {
  @IsString()
  @MinLength(1)
  siteName!: string;

  @IsString()
  siteTagline!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  ogImageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(32)
  @Matches(/^[a-z0-9]{20,32}$/, {
    message: 'loginFeaturedProductId: invalid cuid format',
  })
  loginFeaturedProductId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  loginBadgeFeatured?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  loginBadgeFallback?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  loginFallbackTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  loginSubtitle?: string;
}
