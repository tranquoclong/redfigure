import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ai_api_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ai_model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  ai_product_prompt?: string;
}

export class UpdateAiInstructionPresetsDto {
  @IsOptional()
  @IsArray()
  presets?: unknown[];
}

export class UpdateMediaCaptionPresetsDto {
  @IsOptional()
  @IsArray()
  presets?: unknown[];
}
