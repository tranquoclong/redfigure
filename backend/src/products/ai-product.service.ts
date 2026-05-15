import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import {
  AttributeMatcherService,
  MatchedAttribute,
  UnmatchedAttribute,
} from '../attributes/attribute-matcher.service';
import sharp from 'sharp';

export interface AiGenerateInput {
  images: Buffer[];
  mimeTypes: string[];
  name: string;
  brandName: string;
  hint?: string;
}

export interface AiProductResult {
  title: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  metaTitle?: string;
  seoKeywords: string[];
  altText: string[];
  imageTitles: string[];
  imageDescriptions: string[];
  matchedAttributes: MatchedAttribute[];
  unmatchedAttributes: UnmatchedAttribute[];
}

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_IMAGE_SIZE = 1024;

@Injectable()
export class AiProductService {
  private readonly logger = new Logger(AiProductService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly matcherService: AttributeMatcherService,
  ) { }

  async generate(input: AiGenerateInput): Promise<AiProductResult> {

    const [apiKeyEncrypted, modelSetting, promptSetting] = await Promise.all([
      this.settingsService.get('ai_api_key'),
      this.settingsService.get('ai_model'),
      this.settingsService.get('ai_product_prompt'),
    ]);

    if (!apiKeyEncrypted) {
      throw new BadRequestException(
        'AI API key not configured. Go to Settings > AI to set it up.',
      );
    }

    const apiKey = this.settingsService.decrypt(apiKeyEncrypted);
    const model = modelSetting || DEFAULT_MODEL;
    const prompt = promptSetting || '';

    const imageParts = await Promise.all(
      input.images.map(async (buf, i) => {
        const resized = await this.resizeImage(buf);
        return {
          inlineData: {
            mimeType: input.mimeTypes[i] || 'image/jpeg',
            data: resized.toString('base64'),
          },
        };
      }),
    );

    const textParts = [`Name: ${input.name}`, `Brand: ${input.brandName}`];
    if (input.hint) textParts.push(`Hint: ${input.hint}`);
    const userText = textParts.join('\n');

    const payload = {
      systemInstruction: { parts: [{ text: prompt }] },
      contents: [
        {
          parts: [...imageParts, { text: userText }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    let aiJson: Record<string, unknown> | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {

        let bodyText = '';
        try {
          bodyText = await response.text();
        } catch {

        }
        this.logger.error(
          `Gemini API ${response.status} ${response.statusText}: ${bodyText.slice(0, 800)}`,
        );
        throw new BadRequestException(
          `Gemini API error: ${response.status} ${response.statusText}`,
        );
      }

      const body = await response.json();
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new BadRequestException('Gemini returned empty response');
      }

      try {
        aiJson = JSON.parse(text);
        break;
      } catch {
        if (attempt === 0) {
          this.logger.warn('Gemini returned invalid JSON, retrying...');
          continue;
        }
        throw new BadRequestException(
          'Gemini returned invalid JSON after retry',
        );
      }
    }

    if (!aiJson) {
      throw new BadRequestException('Failed to get valid response from Gemini');
    }

    const aiAttributes = (aiJson.attributes ?? {}) as Record<string, string[]>;
    const { matched, unmatched } =
      await this.matcherService.matchAttributes(aiAttributes);

    return {
      title: (aiJson.title as string) ?? '',
      slug: (aiJson.slug as string) ?? '',
      shortDescription: (aiJson.shortDescription as string) ?? '',
      longDescription: (aiJson.longDescription as string) ?? '',
      metaTitle: (aiJson.metaTitle as string) ?? undefined,
      seoKeywords: (aiJson.seoKeywords as string[]) ?? [],
      altText: (aiJson.altText as string[]) ?? [],
      imageTitles: (aiJson.imageTitles as string[]) ?? [],
      imageDescriptions: (aiJson.imageDescriptions as string[]) ?? [],
      matchedAttributes: matched,
      unmatchedAttributes: unmatched,
    };
  }

  private async resizeImage(buffer: Buffer): Promise<Buffer> {
    try {
      const metadata = await sharp(buffer).metadata();
      const { width, height } = metadata;

      if (
        width &&
        height &&
        (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE)
      ) {
        return sharp(buffer)
          .resize(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
      }

      return buffer;
    } catch {
      return buffer;
    }
  }
}
