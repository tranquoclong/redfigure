import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkUpdateMediaDto } from './bulk-update-media.dto';

describe('BulkUpdateMediaDto', () => {
  const validItem = {
    id: 'cltest1234567890123456789',
    alt: 'photo',
    caption: 'Image',
  };

  it('accepts array with up to 100 items', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      ...validItem,
      id: `cltest${'0123456789'.repeat(2)}${String(i).padStart(3, '0')}`,
    }));
    const dto = plainToInstance(BulkUpdateMediaDto, { items });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty array', async () => {
    const dto = plainToInstance(BulkUpdateMediaDto, { items: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejects more than 100 items (DoS — admin doesn\'t need to update 1k at once)', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      ...validItem,
      id: `cltest${'0123456789'.repeat(2)}${String(i).padStart(3, '0')}`,
    }));
    const dto = plainToInstance(BulkUpdateMediaDto, { items });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejects an item without an id', async () => {
    const dto = plainToInstance(BulkUpdateMediaDto, {
      items: [{ alt: 'photo' }],
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('validates cuid in id (anti recognition)', async () => {
    const dto = plainToInstance(BulkUpdateMediaDto, {
      items: [{ id: 'invalid', alt: 'photo' }],
    });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an item with only id (no update fields — valid no-op)', async () => {
    const dto = plainToInstance(BulkUpdateMediaDto, {
      items: [{ id: validItem.id }],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects caption above the limit', async () => {
    const dto = plainToInstance(BulkUpdateMediaDto, {
      items: [{ id: validItem.id, caption: 'a'.repeat(2001) }],
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
