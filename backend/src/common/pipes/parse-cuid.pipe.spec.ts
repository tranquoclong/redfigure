import { NotFoundException } from '@nestjs/common';
import { ParseCuidPipe } from './parse-cuid.pipe';

describe('ParseCuidPipe - validate cuid v1 before DB hit', () => {
  let pipe: ParseCuidPipe;

  beforeEach(() => {
    pipe = new ParseCuidPipe();
  });

  it('accepts valid cuid v1 (c + [a-z0-9]{20-29})', () => {
    expect(pipe.transform('cm5xj3yk100000abc1234567z')).toBe(
      'cm5xj3yk100000abc1234567z',
    );

    expect(pipe.transform('clxabcdefghijklmnopqrstuv')).toBe(
      'clxabcdefghijklmnopqrstuv',
    );
  });

  it('rejects empty/null/undefined', () => {
    expect(() => pipe.transform('')).toThrow(NotFoundException);

    expect(() => pipe.transform('')).toThrow(/not found/i);
  });

  it('rejects non-cuid format (uuid, numbers, uppercase)', () => {
    expect(() =>
      pipe.transform('550e8400-e29b-41d4-a716-446655440000'),
    ).toThrow(NotFoundException);
    expect(() => pipe.transform('1234567890')).toThrow(NotFoundException);
    expect(() => pipe.transform('CM5XJ3YK100000ABC1234567Z')).toThrow(
      NotFoundException,
    );

    expect(() => pipe.transform('xm5xj3yk100000abc1234567z')).toThrow(
      NotFoundException,
    );
  });

  it('rejects length outside 20-29 (anti payload anormal)', () => {

    expect(() => pipe.transform('cabc')).toThrow(NotFoundException);

    expect(() => pipe.transform('c' + 'a'.repeat(50))).toThrow(
      NotFoundException,
    );
  });

  it('rejects special characters (anti SQL/NoSQL injection patterns)', () => {
    expect(() => pipe.transform("c'; DROP TABLE users; --")).toThrow(
      NotFoundException,
    );
    expect(() => pipe.transform('c<script>alert(1)</script>')).toThrow(
      NotFoundException,
    );
  });
});
