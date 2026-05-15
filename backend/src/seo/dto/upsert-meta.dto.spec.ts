import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertSeoMetaDto } from './upsert-meta.dto';

describe('UpsertSeoMetaDto', () => {
  it('accepts valid meta', async () => {
    const dto = plainToInstance(UpsertSeoMetaDto, {
      entityType: 'product',
      entityId: 'cuid-abc',
      title: 'Title SEO',
      description: 'Desc',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects entityType outside allowlist', async () => {
    const dto = plainToInstance(UpsertSeoMetaDto, {
      entityType: 'evil',
      entityId: 'cuid',
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({ isIn: expect.any(String) });
  });

  it('accepts all types in the allowlist', async () => {
    for (const t of ['product', 'category', 'brand', 'tag', 'page', 'blog']) {
      const dto = plainToInstance(UpsertSeoMetaDto, {
        entityType: t,
        entityId: 'cuid',
      });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('rejects empty entityId', async () => {
    const dto = plainToInstance(UpsertSeoMetaDto, {
      entityType: 'product',
      entityId: '',
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({
      minLength: expect.any(String),
    });
  });

  it('rejects title above 200', async () => {
    const dto = plainToInstance(UpsertSeoMetaDto, {
      entityType: 'product',
      entityId: 'cuid',
      title: 'a'.repeat(201),
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects description above 500', async () => {
    const dto = plainToInstance(UpsertSeoMetaDto, {
      entityType: 'product',
      entityId: 'cuid',
      description: 'a'.repeat(501),
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
