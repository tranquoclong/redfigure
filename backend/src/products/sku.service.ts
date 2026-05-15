import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkuService {
  constructor(private readonly prisma: PrismaService) { }

  async previewNextSku(brandId: string): Promise<string> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: { skuCounter: true },
    });

    if (!brand) {
      throw new BadRequestException('Brand not found');
    }

    if (!brand.skuPrefix) {
      throw new BadRequestException(
        'Brand does not have a configured SKU prefix',
      );
    }

    const currentCounter = brand.skuCounter?.counter ?? 0;
    return this.formatSku(brand.skuPrefix, currentCounter + 1);
  }

  async commitSku(brandId: string, usedSku: string): Promise<void> {
    const number = this.extractNumber(usedSku);
    if (number === null) return;

    await this.prisma.skuCounter.upsert({
      where: { brandId },
      create: { brandId, counter: number },
      update: { counter: number },
    });
  }

  async getSkuForProduct(
    brandId: string,
    manualSku?: string,
  ): Promise<string | undefined> {
    if (manualSku) return manualSku;

    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: { skuCounter: true },
    });

    if (!brand?.skuPrefix) return undefined;

    let counter = (brand.skuCounter?.counter ?? 0) + 1;
    const maxAttempts = 10;

    for (let i = 0; i < maxAttempts; i++) {
      const candidate = this.formatSku(brand.skuPrefix, counter);
      const existing = await this.prisma.product.findUnique({
        where: { sku: candidate },
      });

      if (!existing) return candidate;
      counter++;
    }

    return this.formatSku(brand.skuPrefix, counter);
  }

  private formatSku(prefix: string, number: number): string {
    return `${prefix}${String(number).padStart(4, '0')}`;
  }

  private extractNumber(sku: string): number | null {
    const match = sku.match(/(\d+)$/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }
}
