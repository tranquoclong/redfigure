import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  UpdateAiSettingsDto,
  UpdateAiInstructionPresetsDto,
  UpdateMediaCaptionPresetsDto,
} from './ai-settings.dto';

describe('AI settings DTOs', () => {
  describe('UpdateAiSettingsDto', () => {
    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateAiSettingsDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts api key + model + prompt', async () => {
      const dto = plainToInstance(UpdateAiSettingsDto, {
        ai_api_key: 'AIza-fake',
        ai_model: 'gemini-2.5-flash',
        ai_product_prompt: 'You are an SEO expert.',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects ai_api_key above 500', async () => {
      const dto = plainToInstance(UpdateAiSettingsDto, {
        ai_api_key: 'a'.repeat(501),
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('rejects ai_product_prompt above 50k', async () => {
      const dto = plainToInstance(UpdateAiSettingsDto, {
        ai_product_prompt: 'a'.repeat(50_001),
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });
  });

  describe('UpdateAiInstructionPresetsDto', () => {
    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateAiInstructionPresetsDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts presets array', async () => {
      const dto = plainToInstance(UpdateAiInstructionPresetsDto, {
        presets: [{ name: 'X', text: 'Y' }],
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects non-array presets', async () => {
      const dto = plainToInstance(UpdateAiInstructionPresetsDto, {
        presets: 'string',
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        isArray: expect.any(String),
      });
    });
  });

  describe('UpdateMediaCaptionPresetsDto', () => {
    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateMediaCaptionPresetsDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects non-array presets', async () => {
      const dto = plainToInstance(UpdateMediaCaptionPresetsDto, {
        presets: { foo: 'bar' },
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });
  });
});
