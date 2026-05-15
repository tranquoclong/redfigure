import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

describe('CreateOrderDto — shippingServiceId', () => {
  const base = {
    items: [{ productId: 'prod1', quantity: 1 }],
  };

  it('accepts valid shippingServiceId (integer >= 1)', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      ...base,
      shippingServiceId: 2,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts missing shippingServiceId (optional field)', async () => {
    const dto = plainToInstance(CreateOrderDto, base);
    const shippingErrors = (await validate(dto)).filter(
      (e) => e.property === 'shippingServiceId',
    );
    expect(shippingErrors).toHaveLength(0);
  });

  it('rejects non-integer shippingServiceId', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      ...base,
      shippingServiceId: 1.5,
    });
    const errors = await validate(dto);
    expect(
      errors.some(
        (e) => e.property === 'shippingServiceId' && e.constraints?.isInt,
      ),
    ).toBe(true);
  });

  it('rejects zero or negative shippingServiceId', async () => {
    for (const value of [0, -1, -999]) {
      const dto = plainToInstance(CreateOrderDto, {
        ...base,
        shippingServiceId: value,
      });
      const errors = await validate(dto);
      expect(
        errors.some(
          (e) => e.property === 'shippingServiceId' && e.constraints?.min,
        ),
      ).toBe(true);
    }
  });

  it('rejects string shippingServiceId', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      ...base,
      shippingServiceId: '2',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'shippingServiceId')).toBe(true);
  });
});
