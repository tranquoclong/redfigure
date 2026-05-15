import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttachImagesDto } from './attach-images.dto';

describe('AttachImagesDto', () => {
  it('accepts 1 mediaFileId', async () => {
    const dto = plainToInstance(AttachImagesDto, {
      mediaFileIds: ['cuid-abc'],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts 50 ids (cap)', async () => {
    const dto = plainToInstance(AttachImagesDto, {
      mediaFileIds: Array.from({ length: 50 }, (_, i) => `cuid-${i}`),
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects 0 ids', async () => {
    const dto = plainToInstance(AttachImagesDto, { mediaFileIds: [] });
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({
      arrayMinSize: expect.any(String),
    });
  });

  it('rejects 51 ids (cap+1)', async () => {
    const dto = plainToInstance(AttachImagesDto, {
      mediaFileIds: Array.from({ length: 51 }, (_, i) => `cuid-${i}`),
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects duplicate ids', async () => {
    const dto = plainToInstance(AttachImagesDto, {
      mediaFileIds: ['cuid-1', 'cuid-1'],
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({
      arrayUnique: expect.any(String),
    });
  });

  it('rejects absence of mediaFileIds', async () => {
    const dto = plainToInstance(AttachImagesDto, {});
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
