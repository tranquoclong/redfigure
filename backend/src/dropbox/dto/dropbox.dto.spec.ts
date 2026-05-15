import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DropboxPathsDto, UpdateDropboxSettingsDto } from './dropbox.dto';

describe('Dropbox DTOs', () => {
  describe('DropboxPathsDto', () => {
    it('accepts 1 path', async () => {
      const dto = plainToInstance(DropboxPathsDto, { paths: ['/foo/bar.jpg'] });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts 200 paths (exact cap)', async () => {
      const dto = plainToInstance(DropboxPathsDto, {
        paths: Array.from({ length: 200 }, (_, i) => `/p/${i}.jpg`),
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects 0 paths', async () => {
      const dto = plainToInstance(DropboxPathsDto, { paths: [] });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        arrayMinSize: expect.any(String),
      });
    });

    it('rejects 201 paths (cap + 1)', async () => {
      const dto = plainToInstance(DropboxPathsDto, {
        paths: Array.from({ length: 201 }, (_, i) => `/p/${i}.jpg`),
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        arrayMaxSize: expect.any(String),
      });
    });

    it('rejects duplicate paths', async () => {
      const dto = plainToInstance(DropboxPathsDto, {
        paths: ['/p/1.jpg', '/p/1.jpg'],
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        arrayUnique: expect.any(String),
      });
    });

    it('rejects path longer than 1024 chars (Dropbox API limit)', async () => {
      const dto = plainToInstance(DropboxPathsDto, {
        paths: ['/' + 'a'.repeat(1024)],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects non-string paths', async () => {
      const dto = plainToInstance(DropboxPathsDto, { paths: [123] });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateDropboxSettingsDto', () => {
    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateDropboxSettingsDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts valid credentials', async () => {
      const dto = plainToInstance(UpdateDropboxSettingsDto, {
        accessToken: 'sl.token',
        refreshToken: 'sl.refresh',
        appKey: 'app123',
        appSecret: 'secret456',
        rootPath: '/Miniaturas',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects accessToken longer than 2000 chars', async () => {
      const dto = plainToInstance(UpdateDropboxSettingsDto, {
        accessToken: 'a'.repeat(2001),
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        maxLength: expect.any(String),
      });
    });
  });
});
