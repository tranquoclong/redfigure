import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetGoogleOAuthAdminDto } from './google-oauth-admin.dto';

describe('SetGoogleOAuthAdminDto', () => {
  it('accepts empty object (all optional)', async () => {
    const dto = plainToInstance(SetGoogleOAuthAdminDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts complete config', async () => {
    const dto = plainToInstance(SetGoogleOAuthAdminDto, {
      enabled: true,
      clientId: '12345.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-secret',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts clientId null (clear credential)', async () => {
    const dto = plainToInstance(SetGoogleOAuthAdminDto, { clientId: null });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts clientSecret null', async () => {
    const dto = plainToInstance(SetGoogleOAuthAdminDto, { clientSecret: null });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects enabled non-boolean', async () => {
    const dto = plainToInstance(SetGoogleOAuthAdminDto, { enabled: 'yes' });
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({
      isBoolean: expect.any(String),
    });
  });

  it('rejects clientId above 200', async () => {
    const dto = plainToInstance(SetGoogleOAuthAdminDto, {
      clientId: 'a'.repeat(201),
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects clientSecret above 500', async () => {
    const dto = plainToInstance(SetGoogleOAuthAdminDto, {
      clientSecret: 'a'.repeat(501),
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
