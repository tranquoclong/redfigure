import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateAttributeDto,
  UpdateAttributeDto,
  CreateAttributeValueDto,
} from './attribute.dto';

describe('Attribute DTOs (class-validator validation)', () => {
  describe('CreateAttributeDto', () => {
    it('accepts valid name', async () => {
      const dto = plainToInstance(CreateAttributeDto, { name: 'Cor' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects empty name', async () => {
      const dto = plainToInstance(CreateAttributeDto, { name: '' });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        minLength: expect.any(String),
      });
    });

    it('rejects name longer than 100 chars', async () => {
      const dto = plainToInstance(CreateAttributeDto, {
        name: 'a'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        maxLength: expect.any(String),
      });
    });

    it('rejects non-string name', async () => {
      const dto = plainToInstance(CreateAttributeDto, { name: 123 });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        isString: expect.any(String),
      });
    });

    it('rejects missing name', async () => {
      const dto = plainToInstance(CreateAttributeDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateAttributeDto', () => {
    it('accepts empty object (all optional)', async () => {
      const dto = plainToInstance(UpdateAttributeDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts valid name', async () => {
      const dto = plainToInstance(UpdateAttributeDto, { name: 'Material' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects name longer than 100 chars', async () => {
      const dto = plainToInstance(UpdateAttributeDto, {
        name: 'a'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        maxLength: expect.any(String),
      });
    });
  });

  describe('CreateAttributeValueDto', () => {
    it('accepts valid value', async () => {
      const dto = plainToInstance(CreateAttributeValueDto, {
        value: 'Vermelho',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects empty value', async () => {
      const dto = plainToInstance(CreateAttributeValueDto, { value: '' });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        minLength: expect.any(String),
      });
    });

    it('rejects value longer than 100 chars', async () => {
      const dto = plainToInstance(CreateAttributeValueDto, {
        value: 'a'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        maxLength: expect.any(String),
      });
    });
  });
});
