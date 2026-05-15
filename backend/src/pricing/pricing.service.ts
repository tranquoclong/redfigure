import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';
import { CouponsService } from '../coupons/coupons.service';
// import { PaymentsService } from '../payments/payments.service';
import { CategoriesService } from '../categories/categories.service';
// import { ShippingService } from '../shipping/shipping.service';
import { CustomQuotesService } from '../custom-quotes/custom-quotes.service';
import type {
  PricingInput,
  PricingResult,
  VerifiedItem,
  CouponsResult,
  AppliedCoupon,
  BundleComponentSnapshot,
} from './pricing.types';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private scalesService: ScalesService,
    private couponsService: CouponsService,
    // private paymentsService: PaymentsService,
    private categoriesService: CategoriesService,
    // private shippingService: ShippingService,
    private customQuotesService: CustomQuotesService,
  ) { }

  async calculateOrderPricing(input: PricingInput): Promise<PricingResult> {

    const items = await this.verifyItems(input.items, input.userEmail);
    const subtotal = roundCents(items.reduce((sum, i) => sum + i.lineTotal, 0));

    const coupons = await this.applyCoupons(
      input.couponCodes ?? [],
      subtotal,
      input.userId,
      items,
    );

    const shipping = await this.resolveShipping(
      input.shippingAmount,
      coupons.isFreeShipping,
      input.shippingZipCode,
      input.shippingServiceId,
      input.items,
      subtotal,
      input.userEmail,
    );

    // const paymentDiscount = input.paymentMethod
    //   ? await this.paymentsService.calculateMethodDiscount(
    //     input.paymentMethod,
    //     subtotal,
    //   )
    //   : 0;
    const paymentDiscount = 0;

    const total = roundCents(
      Math.max(subtotal - coupons.totalDiscount + shipping, 0),
    );

    return {
      items,
      subtotal,
      couponDiscount: coupons.totalDiscount,
      appliedCoupons: coupons.applied,
      isFreeShipping: coupons.isFreeShipping,
      shipping,
      paymentDiscount,
      total,
    };
  }

  private async verifyItems(
    inputItems: PricingInput['items'],
    userEmail?: string,
  ): Promise<VerifiedItem[]> {
    const verified: VerifiedItem[] = [];

    for (const item of inputItems) {

      if (item.quoteItemId) {
        if (!userEmail) {
          throw new BadRequestException(
            'Identification required to purchase quote items',
          );
        }
        const qi = await this.customQuotesService.assertQuoteItemPurchasable(
          item.quoteItemId,
          userEmail,
        );
        if (item.quantity > qi.maxQuantity) {
          throw new BadRequestException(
            `Quantity exceeds the item limit (${qi.maxQuantity})`,
          );
        }
        const unitPrice = roundCents(qi.unitPrice);
        verified.push({
          quoteItemId: qi.id,
          quantity: item.quantity,
          basePrice: unitPrice,
          scalePercentage: 0,
          unitPrice,
          lineTotal: roundCents(unitPrice * item.quantity),
          customItemName: qi.name,
          customItemDescription: qi.description ?? undefined,
          customWeight: qi.weight,
          customWidth: qi.width,
          customHeight: qi.height,
          customLength: qi.length,
        });
        continue;
      }

      if (!item.productId) {
        throw new BadRequestException(
          'Invalid item: productId or quoteItemId are required',
        );
      }

      if (item.isFreeGift) {
        if (item.variationId || item.scaleId || item.quoteItemId) {
          throw new BadRequestException(
            'Gift item must be a pure simple product (without variation, scale or budget)',
          );
        }
        const giftProduct = await this.prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
            isDraft: true,
          },
        });
        if (!giftProduct) {
          throw new NotFoundException(
            `Gift product not found: ${item.productId}`,
          );
        }
        if (!giftProduct.isActive || giftProduct.isDraft) {
          throw new BadRequestException(
            'Gift product is unavailable',
          );
        }
        if (giftProduct.type !== 'simple') {
          throw new BadRequestException(
            'Gift product must be a simple product (without variation or bundle)',
          );
        }

        verified.push({
          productId: item.productId,
          quantity: 1,
          basePrice: 0,
          scalePercentage: 0,
          unitPrice: 0,
          lineTotal: 0,
          isFreeGift: true,
          freeGiftId: item.freeGiftId,
        });
        continue;
      }

      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          variations: { where: { deletedAt: null } },
          tags: true,
          attributes: {
            where: {
              attributeValue: {
                deletedAt: null,
                attribute: { deletedAt: null },
              },
            },
            include: { attributeValue: { include: { attribute: true } } },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product not found: ${item.productId}`);
      }
      if (!product.isActive) {
        throw new BadRequestException(
          `Product is not available: ${item.productId}`,
        );
      }

      let basePrice: number;
      let variationName: string | undefined;
      let variationLabel: string | undefined;
      let bundleComponents: BundleComponentSnapshot[] | undefined;
      let bundleDiscount: number | undefined;

      if (product.type === 'bundle') {

        if (item.variationId) {
          throw new BadRequestException(
            'Bundle products cannot have a variation selection',
          );
        }

        const components = await this.prisma.bundleComponent.findMany({
          where: { parentProductId: item.productId },
          include: { childProduct: true, childVariation: true },
        });

        for (const c of components) {
          if (c.childVariation && c.childVariation.deletedAt) {
            throw new BadRequestException(
              `Bundle contains unavailable variation (${c.childProduct.name})`,
            );
          }
          if (c.childProduct.isActive === false) {

            throw new BadRequestException(
              `Bundle contains unavailable product (${c.childProduct.name})`,
            );
          }
        }

        const discount = (product as any).bundleDiscount ?? 0;
        bundleDiscount = discount;

        const sum = components.reduce(
          (
            total: number,
            c: { childVariation: any; childProduct: any; quantity: number },
          ) => {
            const price = c.childVariation
              ? (c.childVariation.salePrice ?? c.childVariation.price)
              : (c.childProduct.salePrice ?? c.childProduct.basePrice);
            return total + price * c.quantity;
          },
          0,
        );

        basePrice = roundCents(sum * (1 - discount / 100));

        bundleComponents = components.map((c: any) => {
          const childPrice = c.childVariation
            ? (c.childVariation.salePrice ?? c.childVariation.price)
            : (c.childProduct.salePrice ?? c.childProduct.basePrice);
          return {
            childProductId: c.childProductId ?? c.childProduct.id,
            childVariationId: c.childVariationId ?? undefined,
            quantity: c.quantity,
            unitPrice: childPrice,
            discountedPrice: roundCents(childPrice * (1 - discount / 100)),
            productName: c.childProduct.name ?? '',
            productImage: undefined,
          };
        });
      } else if (item.variationId) {
        const variation = product.variations?.find(
          (v: { id: string }) => v.id === item.variationId,
        );
        if (!variation) {
          throw new BadRequestException(
            `Variation not found: ${item.variationId}`,
          );
        }
        basePrice = variation.salePrice ?? variation.price;
        variationName = variation.name;

        const varNames = new Set(
          (product.variations ?? []).map((v: { name: string }) =>
            v.name.toLowerCase(),
          ),
        );
        for (const pa of product.attributes ?? []) {
          if (varNames.has(pa.attributeValue.value.toLowerCase())) {
            variationLabel = pa.attributeValue.attribute.name;
            break;
          }
        }
      } else if (product.type === 'variable') {

        throw new BadRequestException(
          'Variation selection is required for this product',
        );
      } else {
        basePrice = product.salePrice ?? product.basePrice;
      }

      let scalePercentage = 0;
      let scaleName: string | undefined;
      let unitPrice = basePrice;

      if (item.scaleId) {
        const ruleSet = await this.scalesService.resolveScaleRule(
          item.productId,
        );
        if (ruleSet) {
          const scaleItem = ruleSet.items.find(
            (i: { id: string }) => i.id === item.scaleId,
          );
          if (!scaleItem) {
            throw new BadRequestException(
              `Scale "${item.scaleId}" not found in product's scale rule`,
            );
          }
          scalePercentage = scaleItem.percentageIncrease;
          scaleName = scaleItem.name;
          unitPrice = this.scalesService.calculateScalePrice(
            basePrice,
            scalePercentage,
          );
        }
      }

      verified.push({
        productId: item.productId,
        variationId: item.variationId,
        scaleId: item.scaleId,
        quantity: item.quantity,
        basePrice,
        scalePercentage,
        unitPrice,
        lineTotal: roundCents(unitPrice * item.quantity),
        variationLabel,
        variationName,
        scaleName,
        bundleComponents,
        bundleDiscount,
      });
    }

    return verified;
  }

  private async resolveShipping(
    shippingAmount: number,
    isCouponFreeShipping: boolean,
    shippingZipCode: string | undefined,
    shippingServiceId: number | undefined,
    items: PricingInput['items'],
    subtotal: number,
    callerEmail: string | undefined,
  ): Promise<number> {

    if (isCouponFreeShipping) return 0;

    if (shippingAmount > 0) {
      if (!shippingZipCode) {
        throw new BadRequestException(
          'ZIP required to validate paid shipping',
        );
      }
      if (!shippingServiceId) {
        throw new BadRequestException(
          'Carrier (serviceId) required to validate paid shipping',
        );
      }
      // const { verifiedAmount } =
      //   await this.shippingService.validateShippingPrice(
      //     items,
      //     shippingZipCode,
      //     shippingServiceId,
      //     shippingAmount,
      //     callerEmail,
      //   );

      return 0;
    }

    // if (!shippingZipCode) {
    //   throw new BadRequestException(
    //     'ZIP required to validate free shipping',
    //   );
    // }
    // await this.shippingService.validateFreeShipping(
    //   items,
    //   shippingZipCode,
    //   subtotal,
    //   callerEmail,
    // );

    return shippingAmount;
  }

  private async applyCoupons(
    couponCodes: string[],
    subtotal: number,
    userId: string,
    items: VerifiedItem[],
  ): Promise<CouponsResult> {
    if (couponCodes.length === 0) {
      return { applied: [], totalDiscount: 0, isFreeShipping: false };
    }

    if (couponCodes.length > 10) {
      throw new BadRequestException('Excessive number of coupons in request');
    }

    const seen = new Set<string>();
    const dedupedCodes = couponCodes
      .map((c) => c.trim().toUpperCase())
      .filter((c) => {
        if (c === '' || seen.has(c)) return false;
        seen.add(c);
        return true;
      });

    const appliedIds: string[] = [];

    type Validated_ = {
      couponId: string;
      code: string;
      type: string;
      value: number;
      isFreeShipping: boolean;

      eligibleProductIds: Set<string> | null;
    };
    const validated: Validated_[] = [];

    for (const code of dedupedCodes) {
      const result = await this.couponsService.validate({
        code,
        cartValue: subtotal,
        userId,
        appliedCouponIds: appliedIds,
      });
      const eligibleProductIds = await this.computeEligibleProductIds(
        result,
        items,
      );
      validated.push({
        couponId: result.couponId,
        code,
        type: result.type,
        value: result.value,
        isFreeShipping:
          result.type === 'FREE_SHIPPING' || result.isFreeShipping === true,
        eligibleProductIds,
      });
      appliedIds.push(result.couponId);
    }

    const orderRank = (type: string): number => {
      if (type === 'FIXED') return 0;
      if (type === 'PERCENTAGE') return 1;
      return 2;
    };
    const sorted = [...validated].sort(
      (a, b) => orderRank(a.type) - orderRank(b.type),
    );

    const applied: AppliedCoupon[] = [];
    let isFreeShipping = false;

    type ItemAccount = {
      productId: string | null | undefined;
      remainingValue: number;
    };
    const accounts: ItemAccount[] = items
      .filter((i) => !i.isFreeGift)
      .map((i) => ({
        productId: i.productId,
        remainingValue: roundCents(i.lineTotal),
      }));

    for (const v of sorted) {
      let discount = 0;

      const eligibleAccounts =
        v.eligibleProductIds === null
          ? accounts
          : accounts.filter(
            (a) =>
              a.productId !== null &&
              a.productId !== undefined &&
              v.eligibleProductIds!.has(a.productId),
          );
      const eligibleRemaining = eligibleAccounts.reduce(
        (s, a) => s + a.remainingValue,
        0,
      );

      if (v.type === 'FIXED') {
        discount = roundCents(Math.min(v.value, eligibleRemaining));
      } else if (v.type === 'PERCENTAGE') {
        discount = roundCents(eligibleRemaining * (v.value / 100));
      }

      if (discount > 0 && eligibleRemaining > 0) {
        let distributed = 0;
        for (let idx = 0; idx < eligibleAccounts.length; idx++) {
          const account = eligibleAccounts[idx];
          const isLast = idx === eligibleAccounts.length - 1;
          const portion = isLast
            ? roundCents(discount - distributed)
            : roundCents(
              discount * (account.remainingValue / eligibleRemaining),
            );

          const safePortion = Math.min(portion, account.remainingValue);
          account.remainingValue = roundCents(
            account.remainingValue - safePortion,
          );
          distributed = roundCents(distributed + safePortion);
        }

        discount = distributed;
      }

      if (v.isFreeShipping) {
        isFreeShipping = true;
      }

      applied.push({
        couponId: v.couponId,
        code: v.code,
        type: v.type,
        discount,
        isFreeShipping: v.isFreeShipping,
      });
    }

    const totalDiscount = roundCents(
      applied.reduce((sum, c) => sum + c.discount, 0),
    );

    return { applied, totalDiscount, isFreeShipping };
  }

  private async computeEligibleProductIds(
    result: { categoryId?: string | null; tagId?: string | null },
    items: VerifiedItem[],
  ): Promise<Set<string> | null> {
    if (!result.categoryId && !result.tagId) return null;

    const productIds = Array.from(
      new Set(
        items
          .map((i) => i.productId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    );

    let eligibleProductIds = new Set<string>(productIds);

    if (result.categoryId) {
      const descendantIds = await this.categoriesService.getDescendantIds(
        result.categoryId,
      );
      const validCatIds = [result.categoryId, ...descendantIds];
      const matches = await this.prisma.productCategory.findMany({
        where: {
          productId: { in: productIds },
          categoryId: { in: validCatIds },
        },
        select: { productId: true },
      });
      const matchedIds = new Set(matches.map((m) => m.productId));
      eligibleProductIds = new Set(
        [...eligibleProductIds].filter((id) => matchedIds.has(id)),
      );
    }

    if (result.tagId) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, tags: { some: { id: result.tagId } } },
        select: { id: true },
      });
      const taggedIds = new Set(products.map((p) => p.id));
      eligibleProductIds = new Set(
        [...eligibleProductIds].filter((id) => taggedIds.has(id)),
      );
    }

    if (eligibleProductIds.size === 0) {
      throw new BadRequestException(
        'No items in cart match the coupon restriction',
      );
    }

    return eligibleProductIds;
  }
}
