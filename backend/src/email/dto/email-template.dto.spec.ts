import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEmailTemplateDto, SendTestEmailDto } from './email-template.dto';

describe('Email template DTOs', () => {
  describe('UpdateEmailTemplateDto', () => {
    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateEmailTemplateDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts subject and htmlBody', async () => {
      const dto = plainToInstance(UpdateEmailTemplateDto, {
        subject: 'Order confirmed',
        htmlBody: '<p>Thank you</p>',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects subject with CRLF (header injection)', async () => {
      const dto = plainToInstance(UpdateEmailTemplateDto, {
        subject: 'Hi\r\nBcc: evil@x.com',
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        matches: expect.any(String),
      });
    });

    it('rejects subject with null byte', async () => {
      const dto = plainToInstance(UpdateEmailTemplateDto, {
        subject: 'Hi\x00BAD',
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('rejects subject with more than 500 characters', async () => {
      const dto = plainToInstance(UpdateEmailTemplateDto, {
        subject: 'a'.repeat(501),
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('rejects htmlBody with more than 200k characters', async () => {
      const dto = plainToInstance(UpdateEmailTemplateDto, {
        htmlBody: 'a'.repeat(200_001),
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });
  });

  describe('SendTestEmailDto', () => {
    it('accepts a valid email', async () => {
      const dto = plainToInstance(SendTestEmailDto, {
        email: 'test@example.com',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('lowercase + trim email via Transform', async () => {
      const dto = plainToInstance(SendTestEmailDto, {
        email: '  Test@Example.COM  ',
      });
      expect(dto.email).toBe('test@example.com');
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects an invalid email', async () => {
      const dto = plainToInstance(SendTestEmailDto, { email: 'notanemail' });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        isEmail: expect.any(String),
      });
    });

    it('rejects an email with more than 254 characters (RFC 5321)', async () => {
      const long = 'a'.repeat(250) + '@x.com';
      const dto = plainToInstance(SendTestEmailDto, { email: long });
      const errors = await validate(dto);
      expect(errors.some((e) => e.constraints?.maxLength)).toBe(true);
    });

    it('rejects an email is absent', async () => {
      const dto = plainToInstance(SendTestEmailDto, {});
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('rejects subject CRLF', async () => {
      const dto = plainToInstance(SendTestEmailDto, {
        email: 't@x.com',
        subject: 'a\r\nbcc: evil@x.com',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.constraints?.matches)).toBe(true);
    });
  });
});
