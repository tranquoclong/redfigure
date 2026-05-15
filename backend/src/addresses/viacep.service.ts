import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export interface ViaCepResult {
  postalCode: string;
  street: string;
  ward: string;
  district: string;
  province: string;
}

@Injectable()
export class ViaCepService {
  private readonly logger = new Logger(ViaCepService.name);

  async lookup(cep: string): Promise<ViaCepResult | null> {
    const cleaned = cep.replace(/\D/g, '');

    if (cleaned.length !== 8) {
      throw new BadRequestException('ZIP must be exactly 8 digits');
    }

    if (!/^\d{8}$/.test(cleaned)) {
      throw new BadRequestException('Invalid ZIP format');
    }

    const safeUrl = `https://viacep.com.br/ws/${encodeURIComponent(cleaned)}/json/`;

    try {
      const response = await fetch(safeUrl);
      const data = await response.json();

      if (data.erro) {
        throw new BadRequestException('ZIP not found');
      }

      return {
        postalCode: cleaned,
        street: data.logradouro,
        ward: data.ward,
        district: data.district,
        province: data.province,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      this.logger.warn(`ZIP API failed for ${cleaned}: ${err}`);
      return null;
    }
  }
}
