import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';
import { CustomQuotesService } from '../custom-quotes/custom-quotes.service';
import { FreeGiftsService } from '../free-gifts/free-gifts.service';
import { ProductsService } from '../products/products.service';

export interface BundleCartChild {
  productId: string;
  productSlug?: string;
  variationId?: string;
  variationName?: string;
  quantity: number;
  unitPrice: number;
  discountedPrice: number;
  name: string;
  image?: string;
}

export interface CartItem {

  productId?: string;
  variationId?: string;
  variationLabel?: string;
  variationName?: string;
  scaleId?: string;
  scaleName?: string;
  scalePercentage?: number;

  quoteItemId?: string;
  quoteToken?: string;
  customItemDescription?: string;
  quantity: number;
  price: number;
  name: string;
  image?: string;

  productSlug?: string;
  brandName?: string;

  bundleDiscount?: number;
  bundleChildren?: BundleCartChild[];

  isFreeGift?: boolean;
  freeGiftId?: string;
}

export interface CartData {
  items: CartItem[];
}

export interface RevalidatedCartItem extends CartItem {

  availableStock: number | null;

  outOfStock: boolean;

  currentPrice: number | null;

  priceChanged: boolean;

  priceChangedDelta: number;

  productionDays: number | null;

  brandId: string | null;

  brandName: string | undefined;

  productSlug: string | undefined;
}

const CART_TTL_SECONDS = 7 * 24 * 60 * 60;
const CART_PREFIX = 'cart:';

const MAX_CART_ITEMS = 100;

const ANON_KEY_PREFIX = 'anonymous:';

function isSafeImageUrl(image: unknown): boolean {
  if (image === undefined) return true;
  if (typeof image !== 'string' || image.length > 500) return false;

  if (image.startsWith('/')) {
    if (image.startsWith('//')) return false;
    if (image.startsWith('/\\')) return false;
    if (image.includes('..')) return false;
    return true;
  }

  try {
    const u = new URL(image);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
    private scalesService: ScalesService,
    private customQuotesService: CustomQuotesService,
    private freeGiftsService: FreeGiftsService,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
  ) { }

  private isLoggedUser(key: string): boolean {
    return !key.startsWith(ANON_KEY_PREFIX);
  }

  private async syncCartToDb(key: string, cart: CartData): Promise<void> {
    if (!this.isLoggedUser(key)) return;
    try {

      if (cart.items.length === 0) {
        await this.prisma.cart
          .delete({ where: { userId: key } })
          .catch((err: unknown) => {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === 'P2025'
            ) {
              return;
            }
            throw err;
          });
        return;
      }

      await this.prisma.cart.upsert({
        where: { userId: key },
        create: {
          userId: key,
          items: cart.items as unknown as Prisma.InputJsonValue,
        },
        update: {
          items: cart.items as unknown as Prisma.InputJsonValue,
          reminderSentAt: null,
          secondReminderSentAt: null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to sync cart to DB (userId=${key}): ${(err as Error).message}`,
      );
    }
  }

  async addQuoteItem(
    userId: string,
    userEmail: string,
    quoteItemId: string,
    quantity: number,
  ): Promise<CartData> {
    const qi = await this.customQuotesService.assertQuoteItemPurchasable(
      quoteItemId,
      userEmail,
    );
    if (quantity > qi.maxQuantity) {
      throw new BadRequestException(
        `Quantity exceeds item limit (${qi.maxQuantity})`,
      );
    }

    const cart = await this.getCartData(userId);
    if (cart.items.length >= MAX_CART_ITEMS) {
      throw new BadRequestException(
        `Cart full (${MAX_CART_ITEMS} items). Remove some to continue.`,
      );
    }

    const existingIndex = cart.items.findIndex(
      (i) => i.quoteItemId === quoteItemId,
    );
    if (existingIndex >= 0) {
      const newQty = cart.items[existingIndex].quantity + quantity;
      if (newQty > qi.maxQuantity) {
        throw new BadRequestException(
          `Quantity exceeds item limit (${qi.maxQuantity})`,
        );
      }
      cart.items[existingIndex].quantity = newQty;
    } else {
      cart.items.push({
        quoteItemId: qi.id,
        quoteToken: (qi as unknown as { quote: { token: string } }).quote
          ?.token,
        quantity,
        price: qi.unitPrice,
        name: qi.name,
        customItemDescription: qi.description ?? undefined,
      });
    }

    await this.saveCartData(userId, cart);
    return cart;
  }

  private cartKey(userId: string): string {
    return `${CART_PREFIX}${userId}`;
  }

  private async getCartData(userId: string): Promise<CartData> {
    const data = await this.redis.getJson<CartData>(this.cartKey(userId));
    return data ?? { items: [] };
  }

  private async saveCartData(userId: string, cart: CartData): Promise<void> {
    await this.redis.setJson(this.cartKey(userId), cart, CART_TTL_SECONDS);

    await this.syncCartToDb(userId, cart);
  }

  private calculateSubtotal(items: CartItem[]): number {

    return (
      Math.round(
        items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        ) * 100,
      ) / 100
    );
  }

  private itemMatches(
    item: CartItem,
    productId: string,
    variationId?: string,
    scaleId?: string,
  ): boolean {
    return (
      item.productId === productId &&
      (item.variationId ?? undefined) === (variationId ?? undefined) &&
      (item.scaleId ?? undefined) === (scaleId ?? undefined)
    );
  }

  async getCart(userId: string) {
    const cart = await this.getCartData(userId);
    return {
      items: cart.items,
      subtotal: this.calculateSubtotal(cart.items),
    };
  }

  async getCartRevalidated(userId: string): Promise<{
    items: RevalidatedCartItem[];
    subtotal: number;
  }> {
    const cart = await this.getCartData(userId);
    if (cart.items.length === 0) return { items: [], subtotal: 0 };

    const enriched = await Promise.all(
      cart.items.map((item) => this.revalidateItem(item)),
    );

    const subtotal =
      Math.round(
        enriched.reduce((sum, item) => {
          const effective = item.currentPrice ?? item.price;
          return sum + effective * item.quantity;
        }, 0) * 100,
      ) / 100;

    return { items: enriched, subtotal };
  }

  async cleanOutOfStock(userId: string): Promise<{
    items: RevalidatedCartItem[];
    subtotal: number;
    removedCount: number;
  }> {
    const revalidated = await this.getCartRevalidated(userId);
    const kept = revalidated.items.filter((i) => !i.outOfStock);
    const removedCount = revalidated.items.length - kept.length;

    if (removedCount === 0) {
      return { ...revalidated, removedCount: 0 };
    }

    const sanitizedItems: CartItem[] = kept.map((it) => {
      const {
        availableStock: _a,
        outOfStock: _o,
        currentPrice: _c,
        priceChanged: _p,
        priceChangedDelta: _d,
        productionDays: _pd,
        brandId: _bi,
        brandName: _bn,
        productSlug: _ps,
        ...rest
      } = it;
      return rest;
    });
    await this.saveCartData(userId, { items: sanitizedItems });

    const subtotal =
      Math.round(
        kept.reduce((sum, item) => {
          const effective = item.currentPrice ?? item.price;
          return sum + effective * item.quantity;
        }, 0) * 100,
      ) / 100;

    return { items: kept, subtotal, removedCount };
  }

  private async revalidateItem(item: CartItem): Promise<RevalidatedCartItem> {

    if (item.quoteItemId) {
      return {
        ...item,
        availableStock: null,
        outOfStock: false,
        currentPrice: null,
        priceChanged: false,
        priceChangedDelta: 0,
        productionDays: null,
        brandId: null,
        brandName: undefined,
        productSlug: undefined,
      };
    }

    if (!item.productId) {
      return {
        ...item,
        availableStock: null,
        outOfStock: true,
        currentPrice: null,
        priceChanged: false,
        priceChangedDelta: 0,
        productionDays: null,
        brandId: null,
        brandName: undefined,
        productSlug: undefined,
      };
    }

    const product = await this.prisma.product.findUnique({
      where: { id: item.productId },
      include: {
        productCategories: {
          select: { category: { select: { extraDays: true } } },
        },
        tags: { select: { extraDays: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    if (!product || !product.isActive || product.isDraft) {
      return {
        ...item,
        availableStock: 0,
        outOfStock: true,
        currentPrice: null,
        priceChanged: false,
        priceChangedDelta: 0,
        productionDays: null,
        brandId: null,
        brandName: undefined,
        productSlug: undefined,
      };
    }

    const productionDays = await this.calcProductionDays(item.productId);
    const brandId = product.brand?.id ?? null;
    const brandName = product.brand?.name ?? undefined;
    const productSlug = product.slug ?? undefined;

    if (product.type === 'bundle') {
      return {
        ...item,
        availableStock: null,
        outOfStock: false,
        currentPrice: null,
        priceChanged: false,
        priceChangedDelta: 0,
        productionDays,
        brandId,
        brandName,
        productSlug,
      };
    }

    let availableStock = 0;
    let manageStock = false;
    let basePrice: number = product.salePrice ?? product.basePrice;

    let variationImage: string | null = null;
    if (item.variationId) {
      const variation = await this.prisma.productVariation.findUnique({
        where: { id: item.variationId },
        include: {

          images: {
            include: { mediaFile: true },
            orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
            take: 1,
          },
        },
      });
      if (!variation || variation.deletedAt) {
        return {
          ...item,
          availableStock: 0,
          outOfStock: true,
          currentPrice: null,
          priceChanged: false,
          priceChangedDelta: 0,
          productionDays,
          brandId,
          brandName,
          productSlug,
        };
      }
      manageStock = variation.manageStock;
      availableStock = variation.stock - (variation.reservedStock ?? 0);
      basePrice = variation.salePrice ?? variation.price;
      variationImage =
        variation.images?.[0]?.mediaFile?.thumb ?? variation.image ?? null;
    } else {
      manageStock = product.manageStock;
      availableStock = product.stock - (product.reservedStock ?? 0);
    }

    const outOfStock = manageStock
      ? availableStock <= 0 || availableStock < item.quantity
      : false;

    let currentPrice: number = basePrice;
    if (item.scaleId) {

      currentPrice = item.price;
    }

    const priceChangedDelta =

      Math.round((currentPrice - item.price) * 100) / 100;
    const priceChanged = priceChangedDelta !== 0;

    return {
      ...item,

      image: variationImage ?? item.image,
      availableStock: manageStock ? Math.max(0, availableStock) : null,
      outOfStock,
      currentPrice,
      priceChanged,
      priceChangedDelta,
      productionDays,
      brandId,
      brandName,
      productSlug,
    };
  }

  private async calcProductionDays(productId: string): Promise<number | null> {
    const days = await this.productsService.resolveExtraDays(productId);
    return days > 0 ? days : null;
  }

  async addItem(
    userId: string,
    dto: {
      productId: string;
      variationId?: string;
      scaleId?: string;
      quantity: number;
    },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        images: {
          include: { mediaFile: true },

          orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
          take: 1,
        },
        variations: { where: { deletedAt: null }, select: { name: true } },
        attributes: {
          where: {
            attributeValue: {
              deletedAt: null,
              attribute: { deletedAt: null },
            },
          },
          include: { attributeValue: { include: { attribute: true } } },
        },

        brand: { select: { name: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }

    if (product.isDraft) {
      throw new BadRequestException(
        'Product is a draft and cannot be purchased',
      );
    }

    if (product.type !== 'bundle') {
      const cart = await this.getCartData(userId);
      const existingIndex = cart.items.findIndex((item) =>
        this.itemMatches(item, dto.productId, dto.variationId),
      );
      const qtyInCart =
        existingIndex >= 0 ? cart.items[existingIndex].quantity : 0;
      const totalDesired = qtyInCart + dto.quantity;

      if (dto.variationId) {
        const variation = await this.prisma.productVariation.findUnique({
          where: { id: dto.variationId },
        });
        if (!variation || variation.deletedAt) {
          throw new NotFoundException('Variation not available');
        }
        if (variation.manageStock) {
          const available = variation.stock - (variation.reservedStock ?? 0);
          if (available <= 0) {
            throw new BadRequestException('Variation out of stock');
          }
          if (totalDesired > available) {
            throw new BadRequestException(
              `Insufficient stock. Available: ${available}`,
            );
          }
        }
      } else if (product.manageStock) {
        const available = product.stock - (product.reservedStock ?? 0);
        if (available <= 0) {
          throw new BadRequestException('Product out of stock');
        }
        if (totalDesired > available) {
          throw new BadRequestException(
            `Insufficient stock. Available: ${available}`,
          );
        }
      }
    }

    let basePrice = product.salePrice ?? product.basePrice;
    let variationName: string | undefined;
    let variationLabel: string | undefined;
    let bundleChildren: BundleCartChild[] | undefined;
    let bundleDiscount: number | undefined;

    let image: string | undefined =
      product.images?.[0]?.mediaFile?.thumb ?? undefined;

    if (product.type === 'bundle') {

      const components = await this.prisma.bundleComponent.findMany({
        where: { parentProductId: dto.productId },
        include: {
          childProduct: {
            include: {
              images: {
                include: { mediaFile: true },
                where: { isMain: true },
                take: 1,
              },
            },
          },
          childVariation: true,
        },
      });

      const discount = (product as any).bundleDiscount ?? 0;
      bundleDiscount = discount;

      const sum = components.reduce((total: number, c: any) => {
        const price = c.childVariation
          ? (c.childVariation.salePrice ?? c.childVariation.price)
          : (c.childProduct.salePrice ?? c.childProduct.basePrice);

        return total + price * c.quantity;
      }, 0);

      basePrice = Math.round(sum * (1 - discount / 100) * 100) / 100;

      bundleChildren = components.map((c: any) => {
        const childPrice = c.childVariation
          ? (c.childVariation.salePrice ?? c.childVariation.price)
          : (c.childProduct.salePrice ?? c.childProduct.basePrice);
        return {
          productId: c.childProductId ?? c.childProduct.id,
          productSlug: c.childProduct.slug,
          variationId: c.childVariationId ?? undefined,
          variationName: c.childVariation?.name,
          quantity: c.quantity,
          unitPrice: childPrice,
          discountedPrice:

            Math.round(childPrice * (1 - discount / 100) * 100) / 100,
          name: c.childProduct.name,
          image:
            c.childProduct.images?.[0]?.mediaFile?.thumb ??
            c.childVariation?.image,
        };
      });
    } else if (dto.variationId) {
      const variation = await this.prisma.productVariation.findUnique({
        where: { id: dto.variationId },
        include: {

          images: {
            include: { mediaFile: true },
            orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
            take: 1,
          },
        },
      });
      if (variation && !variation.deletedAt) {
        basePrice = variation.salePrice ?? variation.price;
        variationName = variation.name;

        const variationMainThumb =
          variation.images?.[0]?.mediaFile?.thumb ?? null;
        if (variationMainThumb) {
          image = variationMainThumb;
        } else if (variation.image) {
          image = variation.image;
        }

        const variationNames = new Set(
          (product.variations ?? []).map((v) => v.name.toLowerCase()),
        );
        for (const pa of product.attributes ?? []) {
          if (variationNames.has(pa.attributeValue.value.toLowerCase())) {
            variationLabel = pa.attributeValue.attribute.name;
            break;
          }
        }
      }
    }

    let finalPrice = basePrice;
    let scaleName: string | undefined;
    let scalePercentage: number | undefined;
    const scaleId = dto.scaleId;

    if (scaleId) {

      const ruleSet = await this.scalesService.resolveScaleRule(dto.productId);
      if (ruleSet) {
        const scaleItem = ruleSet.items.find(
          (i: { id: string }) => i.id === scaleId,
        );
        if (scaleItem) {
          scaleName = scaleItem.name;
          scalePercentage = scaleItem.percentageIncrease;
          finalPrice = this.scalesService.calculateScalePrice(
            basePrice,
            scaleItem.percentageIncrease,
          );
        }
      }
    }

    const cart = await this.getCartData(userId);

    const existingIndex = cart.items.findIndex((item) =>
      this.itemMatches(item, dto.productId, dto.variationId, scaleId),
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += dto.quantity;
    } else {

      if (cart.items.length >= MAX_CART_ITEMS) {
        throw new BadRequestException(
          `Cart full (maximum ${MAX_CART_ITEMS} distinct products)`,
        );
      }
      cart.items.push({
        productId: dto.productId,
        variationId: dto.variationId,
        variationLabel,
        variationName,
        scaleId,
        scaleName,
        scalePercentage,
        quantity: dto.quantity,
        price: finalPrice,
        name: product.name,
        image,
        productSlug: product.slug ?? undefined,
        brandName: product.brand?.name ?? undefined,
        bundleDiscount,
        bundleChildren,
      });
    }

    const synced = await this.syncFreeGiftItems(cart.items);
    await this.saveCartData(userId, { items: synced.items });

    return {
      items: synced.items,
      subtotal: this.calculateSubtotal(synced.items),
    };
  }

  async removeItem(
    userId: string,
    productId: string,
    variationId?: string,
    scaleId?: string,
  ) {
    const cart = await this.getCartData(userId);

    const target = cart.items.find((item) =>
      this.itemMatches(item, productId, variationId, scaleId),
    );
    if (target?.isFreeGift) {
      throw new ForbiddenException(
        'Free gift cannot be removed manually',
      );
    }

    cart.items = cart.items.filter(
      (item) => !this.itemMatches(item, productId, variationId, scaleId),
    );

    const synced = await this.syncFreeGiftItems(cart.items);
    await this.saveCartData(userId, { items: synced.items });

    return {
      items: synced.items,
      subtotal: this.calculateSubtotal(synced.items),
    };
  }

  async updateQuantity(
    userId: string,
    productId: string,
    quantity: number,
    variationId?: string,
    scaleId?: string,
  ) {
    const cart = await this.getCartData(userId);

    const item = cart.items.find((i) =>
      this.itemMatches(i, productId, variationId, scaleId),
    );
    if (!item) {
      throw new NotFoundException('Item not found in cart');
    }

    if (item.isFreeGift) {
      throw new ForbiddenException(
        'Free gift quantity cannot be changed',
      );
    }

    item.quantity = quantity;

    const synced = await this.syncFreeGiftItems(cart.items);
    await this.saveCartData(userId, { items: synced.items });

    return {
      items: synced.items,
      subtotal: this.calculateSubtotal(synced.items),
    };
  }

  async clear(userId: string) {
    await this.redis.del(this.cartKey(userId));

    await this.syncCartToDb(userId, { items: [] });
  }

  private async syncFreeGiftItems(
    items: CartItem[],
  ): Promise<{ items: CartItem[]; changed: boolean }> {
    const nonGifts = items.filter((i) => !i.isFreeGift);
    const currentGift = items.find((i) => i.isFreeGift);

    const subtotal = this.calculateSubtotal(nonGifts);
    const activeGift = await this.freeGiftsService.getActiveGift();
    const shouldHaveGift =
      !!activeGift && subtotal >= activeGift.minOrderAmount;

    if (
      shouldHaveGift &&
      currentGift &&
      activeGift &&
      currentGift.freeGiftId === activeGift.id &&
      currentGift.productId === activeGift.product.id
    ) {
      return { items, changed: false };
    }

    if (!shouldHaveGift && !currentGift) {
      return { items, changed: false };
    }

    const next: CartItem[] = [...nonGifts];
    if (shouldHaveGift && activeGift) {
      next.push({
        productId: activeGift.product.id,
        quantity: 1,
        price: 0,
        name: activeGift.product.name,
        image: activeGift.product.image,
        isFreeGift: true,
        freeGiftId: activeGift.id,
      });
    }
    return { items: next, changed: true };
  }

  async syncFreeGift(userId: string): Promise<void> {
    const cart = await this.getCartData(userId);
    const result = await this.syncFreeGiftItems(cart.items);
    if (result.changed) {
      await this.saveCartData(userId, { items: result.items });
    }
  }

  async getPersistedCartForUser(userId: string): Promise<{
    items: CartItem[];
    updatedAt: Date;
    reminderSentAt: Date | null;
  } | null> {
    const row = await this.prisma.cart.findUnique({
      where: { userId },
    });
    if (!row) return null;
    const rawItems = Array.isArray(row.items) ? row.items : [];
    const items: CartItem[] = [];
    let droppedCount = 0;
    for (const it of rawItems) {
      const sanitized = this.parseAndSanitizeCartItem(it);
      if (sanitized) {
        items.push(sanitized);
      } else {
        droppedCount++;
      }
    }
    if (droppedCount > 0) {

      this.logger.warn(
        `getPersistedCartForUser: dropped ${droppedCount} corrupted item(s) from cart userId=${userId}`,
      );
    }
    return {
      items,
      updatedAt: row.updatedAt,
      reminderSentAt: row.reminderSentAt,
    };
  }

  private parseAndSanitizeCartItem(it: unknown): CartItem | null {
    if (typeof it !== 'object' || it === null) return null;
    const r = it as Record<string, unknown>;

    const hasProductId = typeof r.productId === 'string';
    const hasQuoteItemId = typeof r.quoteItemId === 'string';
    if (!hasProductId && !hasQuoteItemId) return null;

    if (
      typeof r.name !== 'string' ||
      r.name.length > 255 ||
      /[<>"'`]/.test(r.name)
    ) {
      return null;
    }
    if (hasProductId && (r.productId as string).length > 40) return null;
    if (hasQuoteItemId && (r.quoteItemId as string).length > 40) return null;

    if (
      typeof r.quantity !== 'number' ||
      !Number.isInteger(r.quantity) ||
      r.quantity < 1 ||
      r.quantity > 100
    ) {
      return null;
    }
    if (
      typeof r.price !== 'number' ||
      !Number.isFinite(r.price) ||
      r.price < 0
    ) {
      return null;
    }

    if (!isSafeImageUrl(r.image)) return null;

    if (r.bundleChildren !== undefined && !Array.isArray(r.bundleChildren)) {
      return null;
    }

    const safeString = (val: unknown, maxLen = 255): string | undefined => {
      if (typeof val !== 'string' || val.length > maxLen) return undefined;
      if (/[<>"'`]/.test(val)) return undefined;
      return val;
    };

    const safeText = (val: unknown, maxLen = 255): string | undefined => {
      if (typeof val !== 'string' || val.length > maxLen) return undefined;
      return val;
    };

    const safePercent = (val: unknown): number | undefined =>
      typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 100
        ? val
        : undefined;

    const isFreeGift = r.isFreeGift === true;
    if (isFreeGift && (r.price !== 0 || r.quantity !== 1)) {
      return null;
    }
    const freeGiftId =
      typeof r.freeGiftId === 'string' &&
        /^c[a-z0-9]{20,29}$/.test(r.freeGiftId)
        ? r.freeGiftId
        : undefined;
    if (isFreeGift && !freeGiftId) {

      return null;
    }

    return {
      productId: hasProductId ? (r.productId as string) : undefined,
      variationId: safeString(r.variationId, 40),
      variationLabel: safeString(r.variationLabel, 255),
      variationName: safeString(r.variationName, 255),
      scaleId: safeString(r.scaleId, 40),
      scaleName: safeString(r.scaleName, 255),
      scalePercentage: safePercent(r.scalePercentage),
      quoteItemId: hasQuoteItemId ? (r.quoteItemId as string) : undefined,
      quoteToken: safeString(r.quoteToken, 255),
      customItemDescription: safeString(r.customItemDescription, 1000),
      quantity: r.quantity,
      price: r.price,
      name: r.name,
      image: typeof r.image === 'string' ? r.image : undefined,
      productSlug: safeString(r.productSlug, 255),

      brandName: safeText(r.brandName, 255),
      bundleDiscount: safePercent(r.bundleDiscount),

      bundleChildren: Array.isArray(r.bundleChildren)
        ? r.bundleChildren
          .map((child) => this.parseAndSanitizeBundleChild(child))
          .filter((c): c is BundleCartChild => c !== null)
        : undefined,
      isFreeGift: isFreeGift || undefined,
      freeGiftId,
    };
  }

  private parseAndSanitizeBundleChild(it: unknown): BundleCartChild | null {
    if (typeof it !== 'object' || it === null) return null;
    const r = it as Record<string, unknown>;

    if (typeof r.productId !== 'string' || r.productId.length > 40) {
      return null;
    }
    if (
      typeof r.name !== 'string' ||
      r.name.length > 255 ||
      /[<>"'`]/.test(r.name)
    ) {
      return null;
    }
    if (
      typeof r.quantity !== 'number' ||
      !Number.isInteger(r.quantity) ||
      r.quantity < 1 ||
      r.quantity > 100
    ) {
      return null;
    }
    if (
      typeof r.unitPrice !== 'number' ||
      !Number.isFinite(r.unitPrice) ||
      r.unitPrice < 0
    ) {
      return null;
    }
    if (
      typeof r.discountedPrice !== 'number' ||
      !Number.isFinite(r.discountedPrice) ||
      r.discountedPrice < 0
    ) {
      return null;
    }
    if (!isSafeImageUrl(r.image)) return null;

    const safeString = (val: unknown, maxLen = 255): string | undefined => {
      if (typeof val !== 'string' || val.length > maxLen) return undefined;
      if (/[<>"'`]/.test(val)) return undefined;
      return val;
    };

    return {
      productId: r.productId,
      productSlug: safeString(r.productSlug, 255),
      variationId: safeString(r.variationId, 40),
      variationName: safeString(r.variationName, 255),
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      discountedPrice: r.discountedPrice,
      name: r.name,
      image: typeof r.image === 'string' ? r.image : undefined,
    };
  }

  async removeQuoteItem(
    userId: string,
    quoteItemId: string,
  ): Promise<CartData> {
    const cart = await this.getCartData(userId);
    const filtered = cart.items.filter((i) => i.quoteItemId !== quoteItemId);
    cart.items = filtered;
    await this.saveCartData(userId, cart);
    return {
      items: filtered,
      subtotal: this.calculateSubtotal(filtered),
    } as CartData;
  }
}
