import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProductDefaultsDto } from './product-defaults.dto';

describe('UpdateProductDefaultsDto', () => {
  it('accepts empty object', async () => {
    const dto = plainToInstance(UpdateProductDefaultsDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts complete defaults', async () => {
    const dto = plainToInstance(UpdateProductDefaultsDto, {
      weight: '0.3',
      width: '11',
      height: '16',
      length: '2',
      condition: 'new',
      colorId: 'cuid-color',
      materialId: 'cuid-mat',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects condition out of allowlist', async () => {
    const dto = plainToInstance(UpdateProductDefaultsDto, {
      condition: 'evil',
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({ isIn: expect.any(String) });
  });

  it('rejects weight string above 20 chars', async () => {
    const dto = plainToInstance(UpdateProductDefaultsDto, {
      weight: 'a'.repeat(21),
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
