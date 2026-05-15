import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { MediaCaptionPresetService } from './media-caption-preset.service';
import { sanitizeCaption } from '../common/utils/sanitize-caption';
import {
  UpdateAiSettingsDto,
  UpdateAiInstructionPresetsDto,
  UpdateMediaCaptionPresetsDto,
} from './dto/ai-settings.dto';

interface AiInstructionPreset {
  name: string;
  text: string;
}

function sanitizePresets(raw: unknown): AiInstructionPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: AiInstructionPreset[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    const text = typeof e.text === 'string' ? e.text.trim() : '';
    if (!name || !text) continue;
    if (name.length > 80 || text.length > 2000) continue;
    out.push({ name: name.slice(0, 80), text: text.slice(0, 2000) });
  }

  return out.slice(0, 50);
}

function sanitizeCaptionPresets(raw: unknown): AiInstructionPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: AiInstructionPreset[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name.trim().slice(0, 80) : '';
    const text = sanitizeCaption(e.text);
    if (!name || !text) continue;
    out.push({ name, text });
  }
  return out.slice(0, 50);
}

const DEFAULT_PROMPT = `You are an SEO and product cataloging specialist for a 3D miniature store featuring pinups and erotic figures called Red Figure (redfigure.com).

You will receive:
- 1 or 2 images of a 3D miniature (unpainted, in grey or white resin)
- The name of the piece
- The manufacturer brand
- Optionally: a free-text tip about the piece

Your task is to analyze the images and generate a complete JSON for product registration, optimized for SEO.

## MANDATORY RULES

### Title
Fixed format: "[Product Name in English] — Miniature [Theme/Style] | [Brand]"

NAME TRANSLATION:
- Translate descriptive terms to English: "Rainha da Juba" → "Queen of Mane"
- NEVER translate proper/personal names: "Azuza" remains "Azuza", "Lyria" remains "Lyria"

### Short Description (shortDescription)
- Also functions as a meta description for SEO
- Between 120 and 155 characters
- Must naturally contain the keyword "miniature"
- Include a unique selling point of the piece and an implicit call-to-action

### Long Description (longDescription)
- HTML formatted with <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags
- 3 to 5 sections covering: presentation of the piece, visual details observed in the image, painting/scenery suggestions, information for collectors
- Naturally include keywords: "3D miniature", "pinup", "collectible figure", "3D printing", "resin"
- DO NOT invent technical data (weight, dimensions, scale)
- DO NOT use <html>, <head>, <body> tags

### Image Metadata (Mandatory SEO)
For EACH image received, generate the 3 fields below:

**altText** — alternative text (accessibility + SEO)
- Descriptive, accessible, with natural keyword
- Maximum 125 characters each

**imageTitles** — image title (appears on hover and in search engines)
- Concise, with the main product keyword
- Maximum 70 characters each

**imageDescriptions** — long image description (advanced SEO)
- Describes the piece in detail: pose, theme, accessories, material
- Maximum 200 characters each

### Product Attributes
Analyze the images and classify the piece into the following attributes. Each attribute can have ONE OR MORE values.

**Style** — the visual theme/universe of the piece
Examples: Classic Pin-up, Cyberpunk, Fantasy, Sci-Fi, Military, Gothic, Steampunk, Oriental

**Pose** — the body position of the miniature
Examples: Standing, Sitting, Kneeling, Reclining, Dynamic, Leaning

**Clothing** — what the figure is wearing (or not)
Examples: Lingerie, Bikini, Armor, Uniform, Dress, Cosplay, Nude, Topless

**Accessory** — objects, weapons, or items the figure carries or uses
Examples: Sword, Firearm, Shield, Wings, Hat, Staff

**Archetype** — the "character" or role the figure represents
Examples: Warrior, Sorceress, Nurse, Vampire, Angel, Demoness, Mermaid, Elf

**Classification** — content level
Possible values (choose ONLY one): SFW, NSFW, Artistic Nude

### RULES FOR ATTRIBUTE VALUES (CRITICAL)
- Maximum 3 words per value
- Always in the SINGULAR
- No articles (a, an, the)
- First letter of each word capitalized
- If the piece has two items of the same attribute, list both separately

### SEO Keywords
- Array of 5 to 8 long-tail keywords
- Always include "3D miniature" in at least 2 keywords

## OUTPUT FORMAT

Return ONLY a valid JSON, without markdown, without code blocks, without explanation. Exact structure:

{
  "title": "string",
  "slug": "string (kebab-case derived from the title, without the brand, without accents)",
  "shortDescription": "string (120-155 chars)",
  "longDescription": "string (HTML)",
  "metaTitle": "string (max 60 chars)",
  "seoKeywords": ["string"],
  "altText": ["string (one per image received, max 125 chars each)"],
  "imageTitles": ["string (one per image received, max 70 chars each)"],
  "imageDescriptions": ["string (one per image received, max 200 chars each)"],
  "attributes": {
    "Style": ["string"],
    "Pose": ["string"],
    "Clothing": ["string"],
    "Accessory": ["string"],
    "Archetype": ["string"],
    "Classification": ["string"]
  }
}`;

@Controller('api/v1/settings')
export class AiSettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly captionPresets: MediaCaptionPresetService,
  ) { }

  @Roles('ADMIN')
  @Get('ai')
  async getAiSettings() {
    const [apiKey, model, prompt] = await Promise.all([
      this.settingsService.get('ai_api_key'),
      this.settingsService.get('ai_model'),
      this.settingsService.get('ai_product_prompt'),
    ]);

    let maskedKey = '';
    if (apiKey) {
      const decrypted = this.settingsService.decrypt(apiKey);
      maskedKey = decrypted.length > 4 ? '****' + decrypted.slice(-4) : '****';
    }

    return {
      data: {
        ai_api_key: maskedKey,
        ai_model: model ?? 'gemini-2.5-flash',
        ai_product_prompt: prompt ?? DEFAULT_PROMPT,
      },
    };
  }

  @Roles('ADMIN')
  @Put('ai')
  async updateAiSettings(@Body() dto: UpdateAiSettingsDto) {
    if (dto.ai_api_key) {
      const encrypted = this.settingsService.encrypt(dto.ai_api_key);
      await this.settingsService.set('ai_api_key', encrypted);
    }
    if (dto.ai_model) {
      await this.settingsService.set('ai_model', dto.ai_model);
    }
    if (dto.ai_product_prompt !== undefined) {
      await this.settingsService.set(
        'ai_product_prompt',
        dto.ai_product_prompt,
      );
    }
    return { data: { message: 'AI settings updated' } };
  }

  @Roles('ADMIN')
  @Get('ai-models')
  async listAiModels() {
    const apiKeyEncrypted = await this.settingsService.get('ai_api_key');
    if (!apiKeyEncrypted) {
      throw new BadRequestException('API key not configured');
    }

    const apiKey = this.settingsService.decrypt(apiKeyEncrypted);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Failed to fetch models: ${response.status} ${response.statusText}`,
      );
    }

    const body = await response.json();
    const models = (body.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes('generateContent'),
      )
      .map(
        (m: {
          name?: string;
          displayName?: string;
          inputTokenLimit?: number;
        }) => ({
          id: m.name?.replace('models/', '') ?? '',
          name: m.displayName ?? m.name ?? '',
          inputTokenLimit: m.inputTokenLimit ?? 0,
        }),
      );

    return { data: models };
  }

  @Roles('ADMIN')
  @Get('ai-instruction-presets')
  async listAiInstructionPresets() {
    const raw = await this.settingsService.getJson<unknown>(
      'ai_instruction_presets',
    );
    return { data: sanitizePresets(raw) };
  }

  @Roles('ADMIN')
  @Put('ai-instruction-presets')
  async updateAiInstructionPresets(@Body() dto: UpdateAiInstructionPresetsDto) {
    const clean = sanitizePresets(dto?.presets);
    await this.settingsService.setJson('ai_instruction_presets', clean);
    return { data: clean };
  }

  @Roles('ADMIN')
  @Get('media-caption-presets')
  async listMediaCaptionPresets() {
    const data = await this.captionPresets.list();
    return { data };
  }

  @Roles('ADMIN')
  @Put('media-caption-presets')
  async updateMediaCaptionPresets(@Body() dto: UpdateMediaCaptionPresetsDto) {
    const raw = Array.isArray(dto?.presets) ? dto.presets : [];
    const incoming: Array<{ id?: string; name: string; text: string }> = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const id = typeof e.id === 'string' && e.id.length > 0 ? e.id : undefined;
      const name = typeof e.name === 'string' ? e.name.trim().slice(0, 80) : '';
      const text = typeof e.text === 'string' ? e.text.slice(0, 2000) : '';
      if (!name || !text) continue;
      incoming.push({ id, name, text });
      if (incoming.length >= 50) break;
    }
    try {
      const data = await this.captionPresets.syncFromArray(incoming);
      return { data };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Duplicate preset name — each preset needs a unique name',
        );
      }
      throw err;
    }
  }

  @Roles('ADMIN')
  @Post('ai-test')
  async testAiConnection() {
    const apiKeyEncrypted = await this.settingsService.get('ai_api_key');
    if (!apiKeyEncrypted) {
      throw new BadRequestException('API key not configured');
    }

    const apiKey = this.settingsService.decrypt(apiKeyEncrypted);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Connection failed: ${response.status} ${response.statusText}`,
      );
    }

    return { data: { message: 'Connection successful' } };
  }
}
