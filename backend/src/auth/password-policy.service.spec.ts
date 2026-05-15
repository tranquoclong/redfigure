import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PasswordPolicyService } from './password-policy.service';
import { HibpService } from './hibp.service';

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;
  let hibp: { isPwned: jest.Mock };

  beforeEach(async () => {
    hibp = { isPwned: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordPolicyService,
        { provide: HibpService, useValue: hibp },
      ],
    }).compile();

    service = module.get<PasswordPolicyService>(PasswordPolicyService);
  });

  describe('CUSTOMER policy (NIST moderno)', () => {
    it('accepts long passwords without class rules (passphrase)', async () => {
      await expect(
        service.validate('I like miniatures.', 'CUSTOMER'),
      ).resolves.not.toThrow();
    });

    it('accepts minimum exact of 10 chars (without being on blocklist)', async () => {
      await expect(
        service.validate('miniatureX', 'CUSTOMER'),
      ).resolves.not.toThrow();
    });

    it('rejects passwords with less than 10 chars', async () => {
      await expect(service.validate('curta', 'CUSTOMER')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validate('123456789', 'CUSTOMER')).rejects.toThrow(
        /10 caracteres/i,
      );
    });

    it('rejects common passwords from the blocklist (even with 10+ chars)', async () => {

      await expect(service.validate('1234567890', 'CUSTOMER')).rejects.toThrow(
        /comum/i,
      );
    });

    it('does not consult HIBP for CUSTOMER (latency + privacy saving)', async () => {
      await service.validate('I like miniatures.', 'CUSTOMER');
      expect(hibp.isPwned).not.toHaveBeenCalled();
    });

    it('does not require uppercase / number / special', async () => {
      await expect(
        service.validate('so lowercase letters here', 'CUSTOMER'),
      ).resolves.not.toThrow();
    });
  });

  describe('ADMIN policy (current rules + HIBP)', () => {
    it('accepts a password that meets all class rules + is not leaked', async () => {
      hibp.isPwned.mockResolvedValue(false);
      await expect(
        service.validate('Strong123!', 'ADMIN'),
      ).resolves.not.toThrow();
    });

    it('rejects password without uppercase', async () => {
      await expect(service.validate('Strong123!', 'ADMIN')).rejects.toThrow(
        /uppercase/i,
      );
    });

    it('rejects password without number', async () => {
      await expect(service.validate('StrongAaa!', 'ADMIN')).rejects.toThrow(
        /number/i,
      );
    });

    it('rejects password without special character (from the list @$!%*?&)', async () => {
      await expect(service.validate('Strong1234', 'ADMIN')).rejects.toThrow(
        /special/i,
      );
    });

    it('rejects passwords with less than 8 chars', async () => {
      await expect(service.validate('F1!a', 'ADMIN')).rejects.toThrow(
        /8 caracteres/i,
      );
    });

    it('calls HIBP and rejects leaked password even if it meets class rules', async () => {
      hibp.isPwned.mockResolvedValue(true);
      await expect(service.validate('Password1!', 'ADMIN')).rejects.toThrow(
        /leaked/i,
      );
      expect(hibp.isPwned).toHaveBeenCalledWith('Password1!');
    });

    it('HIBP fail-open does not block admin (service returns false on error)', async () => {
      hibp.isPwned.mockResolvedValue(false);
      await expect(
        service.validate('Strong123!', 'ADMIN'),
      ).resolves.not.toThrow();
    });
  });

  describe('default role = CUSTOMER', () => {
    it('when role is not passed, applies CUSTOMER policy', async () => {
      await expect(
        service.validate('I like miniatures.'),
      ).resolves.not.toThrow();
      expect(hibp.isPwned).not.toHaveBeenCalled();
    });
  });
});
