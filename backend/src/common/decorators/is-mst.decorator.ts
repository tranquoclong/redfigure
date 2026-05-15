import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidMST } from '../utils/is-valid-mst';

export function IsMst(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMst',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Invalid MST',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && isValidMST(value);
        },
      },
    });
  };
}
