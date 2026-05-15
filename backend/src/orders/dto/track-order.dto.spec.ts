import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TrackOrderDto } from './track-order.dto';

describe('TrackOrderDto', () => {
  it('accepts valid email', async () => {
    const dto = plainToInstance(TrackOrderDto, { email: 'client@x.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('lowercases + trim email', async () => {
    const dto = plainToInstance(TrackOrderDto, {
      email: '  Client@Example.COM  ',
    });
    expect(dto.email).toBe('client@example.com');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid email', async () => {
    const dto = plainToInstance(TrackOrderDto, { email: 'notetoemail' });
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({
      isEmail: expect.any(String),
    });
  });

  it('rejects missing email', async () => {
    const dto = plainToInstance(TrackOrderDto, {});
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects email above 254', async () => {
    const dto = plainToInstance(TrackOrderDto, {
      email: 'a'.repeat(250) + '@x.com',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.constraints?.maxLength)).toBe(true);
  });
});
