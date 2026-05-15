import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBrandDto, UpdateBrandDto } from './brand.dto';

describe('Brand DTOs', () => {
  describe('CreateBrandDto', () => {
    it('accepts minimal valid brand', async () => {
      const dto = plainToInstance(CreateBrandDto, { name: 'GameZone' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts full brand', async () => {
      const dto = plainToInstance(CreateBrandDto, {
        name: 'GameZone',
        description: 'Brand de miniaturas premium',
        logo: 'https://cdn.com/logo.png',
        skuPrefix: 'GZ-001',
        renameFolderDefault: true,
        scaleRuleSetId: 'cuid-abc',
        noScales: false,
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects empty name', async () => {
      const dto = plainToInstance(CreateBrandDto, { name: '' });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        minLength: expect.any(String),
      });
    });

    it('rejects description > 2000 chars', async () => {
      const dto = plainToInstance(CreateBrandDto, {
        name: 'X',
        description: 'a'.repeat(2001),
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        maxLength: expect.any(String),
      });
    });

    it('rejects skuPrefix with invalid char', async () => {
      const dto = plainToInstance(CreateBrandDto, {
        name: 'X',
        skuPrefix: 'gz lower',
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        matches: expect.any(String),
      });
    });

    it('accepts scaleRuleSetId null', async () => {
      const dto = plainToInstance(CreateBrandDto, {
        name: 'X',
        scaleRuleSetId: null,
      });
      expect(await validate(dto)).toHaveLength(0);
    });
  });

  describe('UpdateBrandDto', () => {
    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateBrandDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects negative skuCounter', async () => {
      const dto = plainToInstance(UpdateBrandDto, { skuCounter: -1 });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        min: expect.any(String),
      });
    });

    it('rejects non-integer skuCounter', async () => {
      const dto = plainToInstance(UpdateBrandDto, { skuCounter: 1.5 });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        isInt: expect.any(String),
      });
    });
  });
});
