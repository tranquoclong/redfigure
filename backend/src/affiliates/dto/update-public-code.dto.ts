import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

const RESERVED_CODES = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'api',
  'redfigure',
  'figure',
  'pinup',
  'official',
  'staff',
  'owner',
  'master',
  'sudo',
  'contact',
  'sales',
  'marketing',
  'security',
  'moderator',
  'bot',
  'test',
  'null',
  'undefined',
]);

@ValidatorConstraint({ name: 'NotReservedCode', async: false })
class NotReservedCodeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null || typeof value !== 'string') return true;
    return !RESERVED_CODES.has(value.trim().toLowerCase());
  }
  defaultMessage(args: ValidationArguments): string {
    return `publicCode "${args.value}" is reserved and cannot be used.`;
  }
}

export class UpdatePublicCodeDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'publicCode must be at least 3 characters' })
  @MaxLength(32, { message: 'publicCode must be at most 32 characters' })
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'publicCode only accepts lowercase, numbers, - and _',
  })
  @Matches(/[a-z_-]/, {
    message: 'publicCode cannot be composed only of numbers',
  })
  @Validate(NotReservedCodeConstraint)
  publicCode?: string | null;
}
