import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTagDto, UpdateTagDto } from './tag.dto';

describe('Tag DTOs', () => {
  describe('CreateTagDto', () => {
    it('accepts minimal name', async () => {
      const dto = plainToInstance(CreateTagDto, { name: 'Promo' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts hex color', async () => {
      const dto = plainToInstance(CreateTagDto, {
        name: 'X',
        color: '#FF00AA',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects non-hex color', async () => {
      const dto = plainToInstance(CreateTagDto, { name: 'X', color: 'blue' });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        isHexColor: expect.any(String),
      });
    });

    it('rejects extraDays above the cap (60)', async () => {
      const dto = plainToInstance(CreateTagDto, { name: 'X', extraDays: 61 });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        max: expect.any(String),
      });
    });

    it('rejects negative extraDays', async () => {
      const dto = plainToInstance(CreateTagDto, { name: 'X', extraDays: -1 });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        min: expect.any(String),
      });
    });

    it('rejects name above 80 chars', async () => {
      const dto = plainToInstance(CreateTagDto, { name: 'a'.repeat(81) });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        maxLength: expect.any(String),
      });
    });
  });

  describe('UpdateTagDto', () => {
    it('accepts null scaleRuleSetId (clear)', async () => {
      const dto = plainToInstance(UpdateTagDto, { scaleRuleSetId: null });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateTagDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });
  });
});
