import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateRuleSetDto,
  UpdateRuleSetDto,
  CreateRuleItemDto,
  UpdateRuleItemDto,
  ReorderRuleItemsDto,
} from './scale.dto';

describe('Scale DTOs', () => {
  describe('CreateRuleSetDto', () => {
    it('accepts name', async () => {
      const dto = plainToInstance(CreateRuleSetDto, { name: 'Padrao' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects empty name', async () => {
      const dto = plainToInstance(CreateRuleSetDto, { name: '' });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        minLength: expect.any(String),
      });
    });

    it('rejects name above 100', async () => {
      const dto = plainToInstance(CreateRuleSetDto, { name: 'a'.repeat(101) });
      expect(await validate(dto)).not.toHaveLength(0);
    });
  });

  describe('UpdateRuleSetDto', () => {
    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateRuleSetDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });
  });

  describe('CreateRuleItemDto', () => {
    it('accepts complete item', async () => {
      const dto = plainToInstance(CreateRuleItemDto, {
        name: '75mm',
        percentageIncrease: 100,
        sortOrder: 2,
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects percentageIncrease below -100', async () => {
      const dto = plainToInstance(CreateRuleItemDto, {
        name: 'X',
        percentageIncrease: -101,
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({ min: expect.any(String) });
    });

    it('rejects percentageIncrease above 1000', async () => {
      const dto = plainToInstance(CreateRuleItemDto, {
        name: 'X',
        percentageIncrease: 1001,
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({ max: expect.any(String) });
    });

    it('rejects non-numeric percentageIncrease', async () => {
      const dto = plainToInstance(CreateRuleItemDto, {
        name: 'X',
        percentageIncrease: 'cem',
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        isNumber: expect.any(String),
      });
    });
  });

  describe('UpdateRuleItemDto', () => {
    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateRuleItemDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });
  });

  describe('ReorderRuleItemsDto', () => {
    it('accepts array with 1+ items', async () => {
      const dto = plainToInstance(ReorderRuleItemsDto, {
        itemIds: ['cuid-1', 'cuid-2'],
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects empty array', async () => {
      const dto = plainToInstance(ReorderRuleItemsDto, { itemIds: [] });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        arrayMinSize: expect.any(String),
      });
    });

    it('rejects array with duplicates', async () => {
      const dto = plainToInstance(ReorderRuleItemsDto, {
        itemIds: ['cuid-1', 'cuid-1'],
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        arrayUnique: expect.any(String),
      });
    });

    it('rejects array above 200 items (DoS)', async () => {
      const dto = plainToInstance(ReorderRuleItemsDto, {
        itemIds: Array.from({ length: 201 }, (_, i) => `cuid-${i}`),
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        arrayMaxSize: expect.any(String),
      });
    });
  });
});
