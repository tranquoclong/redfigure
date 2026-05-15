import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidCccd } from '../utils/is-valid-cccd';

export function IsCccd(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCccd',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Invalid CCCD',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && isValidCccd(value);
        },
      },
    });
  };
}
