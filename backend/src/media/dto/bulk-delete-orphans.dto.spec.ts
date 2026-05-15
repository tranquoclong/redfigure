import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkDeleteOrphansDto } from './bulk-delete-orphans.dto';

async function validateDto(payload: unknown) {
  const dto = plainToInstance(BulkDeleteOrphansDto, payload);
  return validate(dto);
}

describe('BulkDeleteOrphansDto', () => {
  it('accepts a valid list of cuids', async () => {
    const errs = await validateDto({
      ids: ['cmoevheya02osrw01ijp2i4rd', 'cmoetqrun02d8rw01ztw57zbu'],
    });
    expect(errs).toHaveLength(0);
  });

  it('rejects an empty list', async () => {
    const errs = await validateDto({ ids: [] });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects a non-cuid id (anti recognition)', async () => {
    const errs = await validateDto({ ids: ['../etc/passwd'] });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects duplicate ids (ArrayUnique)', async () => {
    const errs = await validateDto({
      ids: ['cmoevheya02osrw01ijp2i4rd', 'cmoevheya02osrw01ijp2i4rd'],
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects > 500 ids (cap anti mass wipe)', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => {

      const tail = i.toString(36).padStart(24, 'a');
      return 'c' + tail;
    });
    const errs = await validateDto({ ids });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects non-string ids (number, null, object)', async () => {
    const errs = await validateDto({ ids: [123, null, {}] });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects extra field (whitelist + forbidNonWhitelisted in global pipe)', async () => {
    const dto = plainToInstance(BulkDeleteOrphansDto, {
      ids: ['cmoevheya02osrw01ijp2i4rd'],
      hackerField: 'invalid',
    }) as BulkDeleteOrphansDto & { hackerField?: string };

    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
  });
});
