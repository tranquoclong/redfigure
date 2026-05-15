import { BadRequestException, Injectable } from '@nestjs/common';
import { HibpService } from './hibp.service';
import { COMMON_PASSWORDS } from './common-passwords';

export type UserRole = 'ADMIN' | 'CUSTOMER';

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly hibp: HibpService) { }

  async validate(password: string, role: UserRole = 'CUSTOMER'): Promise<void> {
    if (role === 'ADMIN') {
      this.validateAdmin(password);
      if (await this.hibp.isPwned(password)) {
        throw new BadRequestException(
          'This password appeared in public leaks. Choose another.',
        );
      }
      return;
    }
    this.validateCustomer(password);
  }

  private validateCustomer(password: string) {
    if (password.length < 10) {
      throw new BadRequestException(
        'The password must be at least 10 characters long.',
      );
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      throw new BadRequestException(
        'This password is too common. Choose something less obvious - a short phrase works well.',
      );
    }
  }

  private validateAdmin(password: string) {
    if (password.length < 8) {
      throw new BadRequestException(
        'The password must be at least 8 characters long.',
      );
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException(
        'The admin password must contain at least one uppercase letter.',
      );
    }
    if (!/\d/.test(password)) {
      throw new BadRequestException(
        'The admin password must contain at least one number.',
      );
    }
    if (!/[@$!%*?&]/.test(password)) {
      throw new BadRequestException(
        'The admin password must contain at least one special character (@ $ ! % * ? &).',
      );
    }
  }
}
