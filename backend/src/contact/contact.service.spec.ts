import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContactService } from './contact.service';
import { parseEmailRecipients } from '../common/utils/email-recipients';
import { TurnstileService } from '../turnstile/turnstile.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';

describe('ContactService', () => {
  let service: ContactService;
  let turnstile: jest.Mocked<TurnstileService>;
  let email: jest.Mocked<EmailService>;
  let settings: jest.Mocked<SettingsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        {
          provide: TurnstileService,
          useValue: { verify: jest.fn() },
        },
        {
          provide: EmailService,
          useValue: { sendContactMessage: jest.fn() },
        },
        {
          provide: SettingsService,
          useValue: {
            get: jest.fn().mockResolvedValue('admin@redfigure.com'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
      ],
    }).compile();

    service = module.get(ContactService);
    turnstile = module.get(TurnstileService);
    email = module.get(EmailService);
    settings = module.get(SettingsService);
  });

  const baseInput = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    message: 'Test message with at least ten characters.',
    turnstileToken: 'cf-token-xyz',
    acceptLgpd: true,
    ipAddress: '203.0.113.5',
    userAgent: 'Mozilla/5.0',
  };

  describe('submit — honeypot', () => {
    it('silently returns ok when honeypot has any value (no turnstile, no email)', async () => {
      const result = await service.submit({
        ...baseInput,
        honeypot: 'bot-fill',
      });

      expect(result).toEqual({ ok: true });
      expect(turnstile.verify).not.toHaveBeenCalled();
      expect(email.sendContactMessage).not.toHaveBeenCalled();
    });

    it('proceeds normally when honeypot is empty string', async () => {
      turnstile.verify.mockResolvedValue(true);
      email.sendContactMessage.mockResolvedValue();
      await service.submit({ ...baseInput, honeypot: '' });
      expect(turnstile.verify).toHaveBeenCalled();
      expect(email.sendContactMessage).toHaveBeenCalled();
    });

    it('proceeds normally when honeypot is undefined', async () => {
      turnstile.verify.mockResolvedValue(true);
      email.sendContactMessage.mockResolvedValue();
      await service.submit({ ...baseInput });
      expect(turnstile.verify).toHaveBeenCalled();
    });

    it('treats whitespace-only honeypot as filled (silent ok)', async () => {
      const result = await service.submit({ ...baseInput, honeypot: '   ' });
      expect(result).toEqual({ ok: true });
      expect(turnstile.verify).not.toHaveBeenCalled();
      expect(email.sendContactMessage).not.toHaveBeenCalled();
    });

    it('sanitizes CRLF from userAgent before logging (log injection)', async () => {
      const warnSpy = jest
        .spyOn(
          (service as unknown as { logger: { warn: jest.Mock } }).logger,
          'warn',
        )
        .mockImplementation(() => { });

      await service.submit({
        ...baseInput,
        honeypot: 'bot',
        userAgent: 'Mozilla/5.0\r\nFAKE LOG ENTRY: user=admin logged in',
        ipAddress: '1.2.3.4\r\n10.0.0.1',
      });

      const logged = warnSpy.mock.calls[0]?.[0] ?? '';
      expect(logged).not.toContain('\n');
      expect(logged).not.toContain('\r');

      expect(logged).toContain('Mozilla/5.0');
      warnSpy.mockRestore();
    });
  });

  describe('submit — LGPD consent', () => {
    it('throws BadRequest when acceptLgpd is false', async () => {
      await expect(
        service.submit({ ...baseInput, acceptLgpd: false }),
      ).rejects.toThrow(BadRequestException);
      expect(turnstile.verify).not.toHaveBeenCalled();
      expect(email.sendContactMessage).not.toHaveBeenCalled();
    });
  });

  describe('submit — Turnstile', () => {
    it('calls turnstile.verify with token + IP', async () => {
      turnstile.verify.mockResolvedValue(true);
      email.sendContactMessage.mockResolvedValue();

      await service.submit(baseInput);

      expect(turnstile.verify).toHaveBeenCalledWith(
        'cf-token-xyz',
        '203.0.113.5',
      );
    });

    it('throws BadRequest and skips email when turnstile fails', async () => {
      turnstile.verify.mockResolvedValue(false);
      await expect(service.submit(baseInput)).rejects.toThrow(
        BadRequestException,
      );
      expect(email.sendContactMessage).not.toHaveBeenCalled();
    });
  });

  describe('submit — email dispatch', () => {
    beforeEach(() => {
      turnstile.verify.mockResolvedValue(true);
      email.sendContactMessage.mockResolvedValue();
    });

    it('sends to setting recipient(s) with trimmed name/message + lowercase email', async () => {
      await service.submit({
        ...baseInput,
        name: '  John Doe  ',
        email: '  JOHN@EXAMPLE.COM  ',
        message: '  Message with spaces  ',
      });

      expect(email.sendContactMessage).toHaveBeenCalledWith({
        to: 'admin@redfigure.com',
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Message with spaces',
        ipAddress: '203.0.113.5',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('returns { ok: true } on success', async () => {
      const result = await service.submit(baseInput);
      expect(result).toEqual({ ok: true });
    });

    it('sends to all emails when setting has multiple CSV entries', async () => {
      settings.get.mockResolvedValue('a@x.com, b@y.com ,c@z.com');

      await service.submit(baseInput);

      expect(email.sendContactMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@x.com, b@y.com, c@z.com' }),
      );
    });

    it('falls back to ADMIN_EMAIL env when setting is empty', async () => {
      settings.get.mockResolvedValue(null);
      const envSpy = jest
        .spyOn(
          (service as unknown as { configService: ConfigService })
            .configService,
          'get',
        )
        .mockImplementation((key) =>
          key === 'ADMIN_EMAIL' ? 'fallback@redfigure.com' : undefined,
        );

      await service.submit(baseInput);

      expect(email.sendContactMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'fallback@redfigure.com' }),
      );
      envSpy.mockRestore();
    });

    it('throws InternalServerError when no recipients (setting empty + env empty)', async () => {
      settings.get.mockResolvedValue(null);
      await expect(service.submit(baseInput)).rejects.toThrow();
      expect(email.sendContactMessage).not.toHaveBeenCalled();
    });

    it('deduplicates case-insensitive emails in setting CSV', async () => {
      settings.get.mockResolvedValue('a@x.com, A@X.COM, b@y.com');
      await service.submit(baseInput);
      expect(email.sendContactMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@x.com, b@y.com' }),
      );
    });
  });
});

describe('parseEmailRecipients', () => {
  it('parses CSV, trims, lowercases, dedupes, filters empty', () => {
    expect(
      parseEmailRecipients(' A@X.com, b@y.com ,,a@x.COM, c@z.com '),
    ).toEqual(['a@x.com', 'b@y.com', 'c@z.com']);
  });

  it('returns empty array for null/undefined/empty', () => {
    expect(parseEmailRecipients(null)).toEqual([]);
    expect(parseEmailRecipients(undefined)).toEqual([]);
    expect(parseEmailRecipients('')).toEqual([]);
    expect(parseEmailRecipients('   ,  , ')).toEqual([]);
  });
});
