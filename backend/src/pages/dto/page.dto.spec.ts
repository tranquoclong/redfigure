import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePageDto } from './page.dto';

describe('UpdatePageDto', () => {
  it('accepts empty object', async () => {
    const dto = plainToInstance(UpdatePageDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts meta fields null (clear)', async () => {
    const dto = plainToInstance(UpdatePageDto, {
      metaTitle: null,
      metaDescription: null,
      ogImage: null,
      faqItems: null,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts valid faqItems', async () => {
    const dto = plainToInstance(UpdatePageDto, {
      faqItems: [
        { question: 'How to do X?', answer: 'Detailed answer' },
        { question: 'How much does it cost?', answer: '100000VND' },
      ],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects faqItems above 50 (DoS)', async () => {
    const dto = plainToInstance(UpdatePageDto, {
      faqItems: Array.from({ length: 51 }, () => ({
        question: 'q',
        answer: 'a',
      })),
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({
      arrayMaxSize: expect.any(String),
    });
  });

  it('rejects faqItems with empty question', async () => {
    const dto = plainToInstance(UpdatePageDto, {
      faqItems: [{ question: '', answer: 'a' }],
    });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects content above 200k chars', async () => {
    const dto = plainToInstance(UpdatePageDto, {
      content: 'a'.repeat(200_001),
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({
      maxLength: expect.any(String),
    });
  });
});
