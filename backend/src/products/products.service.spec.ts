import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';
import { MerchantFieldsService } from './merchant-fields.service';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { RedisService } from '../redis/redis.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;
  let mockCategoriesService: any;
  let redis: { getJson: jest.Mock; setJson: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    mockCategoriesService = {
      getDescendantIds: jest.fn().mockResolvedValue([]),
      getAncestors: jest.fn().mockResolvedValue([]),
      resolveInheritedField: jest.fn().mockResolvedValue(null),
    };

    redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
              aggregate: jest.fn().mockResolvedValue({
                _min: { basePrice: 0 },
                _max: { basePrice: 100 },
              }),
            },
            brand: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            attribute: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            attributeValue: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            productAttribute: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
            productImage: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            productVariation: {
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              updateMany: jest.fn(),
              createMany: jest.fn(),
              update: jest.fn(),
            },
            productVariationImage: {
              createMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            productCategory: {
              createMany: jest.fn(),
              deleteMany: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
            stockAuditLog: {
              create: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              deleteMany: jest.fn(),
            },
            bundleComponent: {
              createMany: jest.fn(),
              deleteMany: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
        {
          provide: RedisService,
          useValue: redis,
        },
        MerchantFieldsService,
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const mockProduct = {
    id: 'prod1',
    name: 'Warrior Miniature',
    slug: 'warrior-miniature',
    description: 'A mighty warrior miniature',
    shortDescription: 'Warrior mini',
    basePrice: 49.9,
    salePrice: null,
    type: 'simple',
    isActive: true,
    featured: false,
    manageStock: true,
    stock: 50,
    brandId: 'brand1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create product with auto-generated slug', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.create({
        name: 'Warrior Miniature',
        description: 'A mighty warrior miniature',
        basePrice: 49.9,
      });

      expect(result.slug).toBe('warrior-miniature');
    });

    it('should use custom slug when provided', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        slug: 'custom-slug',
      });

      const result = await service.create({
        name: 'Warrior Miniature',
        slug: 'custom-slug',
        description: 'A mighty warrior miniature',
        basePrice: 49.9,
      });

      expect(result.slug).toBe('custom-slug');
    });

    it('should throw ConflictException when admin passes duplicate EXPLICIT slug', async () => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      await expect(
        service.create({
          name: 'Warrior Miniature',
          slug: 'warrior-miniature',
          description: 'Duplicate description here',
          basePrice: 49.9,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should auto-dedup slug when auto-generated from name collides', async () => {

      (prisma.product.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        slug: 'warrior-miniature-2',
      });

      const result = await service.create({
        name: 'Warrior Miniature',
        description: 'desc',
        basePrice: 49.9,
      });

      expect(result.slug).toBe('warrior-miniature-2');
    });

    it('should accept draft with missing description/basePrice', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        isDraft: true,
      });

      await service.create({
        name: 'Draft',
        isDraft: true,

      } as never);

      const call = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(call.data.basePrice).toBe(0);
      expect(call.data.description).toBe('');
      expect(call.data.isDraft).toBe(true);
    });

    it('should retry with -2 suffix when TOCTOU race triggers P2002', async () => {

      const p2002 = Object.assign(new Error('unique'), {
        code: 'P2002',
        meta: { target: ['slug'] },
      });
      (prisma.product.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prisma.product.create as jest.Mock)
        .mockRejectedValueOnce(p2002)
        .mockResolvedValueOnce({ ...mockProduct, slug: 'warrior-2' });

      const result = await service.create({
        name: 'Warrior',
        description: 'desc',
        basePrice: 49.9,
      });

      expect(result.slug).toBe('warrior-2');
    });

    it('should throw 409 after MAX_RETRIES exausted (prevents 500 on high concurrency)', async () => {

      const p2002 = Object.assign(new Error('unique'), {
        code: 'P2002',
        meta: { target: ['slug'] },
      });
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockRejectedValue(p2002);

      await expect(
        service.create({
          name: 'Warrior Burst',
          description: 'desc',
          basePrice: 49.9,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create product with tags and attributes', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue(mockProduct);

      await service.create({
        name: 'Full Product',
        description: 'Product with all fields filled in',
        basePrice: 49.9,
        salePrice: 39.9,
        shortDescription: 'Short desc',
        type: 'simple',

        sku: 'WAR-001',
        gtin: '1234567890123',
        manageStock: true,
        stock: 50,
        weight: 0.1,
        width: 5,
        height: 8,
        length: 3,
        extraDays: 2,
        tagIds: ['tag1', 'tag2'],
        attributeValueIds: ['av1', 'av2'],
      });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            salePrice: 39.9,
            type: 'simple',
            gtin: '1234567890123',
            extraDays: 2,
            tags: { connect: [{ id: 'tag1' }, { id: 'tag2' }] },
            attributes: {
              create: [
                { attributeValueId: 'av1' },
                { attributeValueId: 'av2' },
              ],
            },
          }),
        }),
      );
    });
  });

  describe('findBySlug', () => {
    it('should return product with all relations', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        ...mockProduct,
        productCategories: [],
        brand: { id: 'brand1', name: 'Arsenal' },
        tags: [],
        images: [],
        variations: [],
        attributes: [],
        relatedProducts: [],
      });

      const result = await service.findBySlug('warrior-miniature');

      expect(result.slug).toBe('warrior-miniature');

      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'warrior-miniature', isActive: true, isDraft: false },
          include: expect.objectContaining({
            attributes: expect.any(Object),
            relatedProducts: true,
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct]);
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({ page: 1, perPage: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        perPage: 10,
        lastPage: 1,
      });
    });

    it('should only return active products', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 1, perPage: 10 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('should filter by attribute values', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({
        page: 1,
        perPage: 10,
        attributeValueIds: ['av1', 'av2'],
      });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attributes: {
              some: { attributeValueId: { in: ['av1', 'av2'] } },
            },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update product and replace attributes', async () => {
      (prisma.productAttribute.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.productAttribute.createMany as jest.Mock).mockResolvedValue({});
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        salePrice: 39.9,
      });

      await service.update('prod1', {
        salePrice: 39.9,
        attributeValueIds: ['av3', 'av4'],
      });

      expect(prisma.productAttribute.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'prod1' },
      });
      expect(prisma.productAttribute.createMany).toHaveBeenCalledWith({
        data: [
          { productId: 'prod1', attributeValueId: 'av3' },
          { productId: 'prod1', attributeValueId: 'av4' },
        ],
      });
    });
  });

  describe('remove (hard delete)', () => {
    it('should hard delete the product', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.product.delete as jest.Mock).mockResolvedValue(mockProduct);

      await service.remove('prod1');

      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { id: 'prod1' },
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when FK blocks delete', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      const err = new Prisma.PrismaClientKnownRequestError('FK violation', {
        code: 'P2003',
        clientVersion: '6.0.0',
      });
      (prisma.product.delete as jest.Mock).mockRejectedValue(err);

      await expect(service.remove('blocked')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe.skip('image caption (moved to sanitize-caption.spec)', () => {
    const baseDto = {
      name: 'Prod Caption',
      description: 'desc',
      basePrice: 10,
    };

    beforeEach(() => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue(mockProduct);
    });

    it('persists caption when provided, trimmed and capped', async () => {
      await service.create({
        ...baseDto,
        images: [
          {
            mediaFileId: 'mf-1',
            isMain: true,
            order: 0,
            caption: '  Illustrative image — we do not sell painted  ',
          },
        ],
      });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: {
              create: [
                expect.objectContaining({
                  mediaFileId: 'mf-1',
                  caption: 'Illustrative image — we do not sell painted',
                }),
              ],
            },
          }),
        }),
      );
    });

    it('persists null when caption is empty/whitespace/absent', async () => {
      await service.create({
        ...baseDto,
        images: [
          { mediaFileId: 'mf-1', isMain: true, order: 0 },
          { mediaFileId: 'mf-2', isMain: false, order: 1, caption: '   ' },
        ],
      });

      const payload = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(payload.data.images.create[0].caption).toBeNull();
      expect(payload.data.images.create[1].caption).toBeNull();
    });

    it('caps caption at 200 chars', async () => {
      const long = 'a'.repeat(500);
      await service.create({
        ...baseDto,
        images: [
          { mediaFileId: 'mf-1', isMain: true, order: 0, caption: long },
        ],
      });
      const payload = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(payload.data.images.create[0].caption).toHaveLength(200);
    });

    it('strips unicode bidi/zero-width chars (anti-UI-spoof)', async () => {

      await service.create({
        ...baseDto,
        images: [
          {
            mediaFileId: 'mf-1',
            isMain: true,
            order: 0,
            caption: 'Image\u202E illustrative\u200B\u2060',
          },
        ],
      });
      const payload = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(payload.data.images.create[0].caption).toBe('Image illustrative');
    });

    it('truncates by grapheme cluster, not UTF-16 index (no emoji split)', async () => {

      const emoji = '🚀';
      const caption = emoji.repeat(150);
      await service.create({
        ...baseDto,
        images: [{ mediaFileId: 'mf-1', isMain: true, order: 0, caption }],
      });
      const payload = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(payload.data.images.create[0].caption).toBe(caption);
      expect(
        (payload.data.images.create[0].caption as string).includes('\uFFFD'),
      ).toBe(false);
    });

    it('preserves ZWJ-joined emojis (family, skin tone)', async () => {

      const family = '👨\u200D👩\u200D👧\u200D👦';
      await service.create({
        ...baseDto,
        images: [
          {
            mediaFileId: 'mf-1',
            isMain: true,
            order: 0,
            caption: `Family ${family} happy`,
          },
        ],
      });
      const payload = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(payload.data.images.create[0].caption).toBe(
        `Family ${family} happy`,
      );
    });

    it('rejects captions composed only of invisible bypass chars', async () => {

      await service.create({
        ...baseDto,
        images: [
          {
            mediaFileId: 'mf-1',
            isMain: true,
            order: 0,
            caption: '\u2800\u2800\u3164',
          },
        ],
      });
      const payload = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(payload.data.images.create[0].caption).toBeNull();
    });

    it('normalizes NFC (é precomposto vs e+combining acute)', async () => {

      const decomposed = 'Illustra\u0063\u0327\u0061\u0303o'; // Illustration with combining marks (c + cedilla + a + tilde)
      await service.create({
        ...baseDto,
        images: [
          { mediaFileId: 'mf-1', isMain: true, order: 0, caption: decomposed },
        ],
      });
      const payload = (prisma.product.create as jest.Mock).mock.calls[0][0];
      const saved = payload.data.images.create[0].caption as string;
      expect(saved.normalize('NFC')).toBe(saved);
    });

    it('caps Zalgo combining marks (anti-rendering-crash)', async () => {

      const zalgo = 'a' + '\u0301'.repeat(100) + 'b';
      await service.create({
        ...baseDto,
        images: [
          { mediaFileId: 'mf-1', isMain: true, order: 0, caption: zalgo },
        ],
      });
      const payload = (prisma.product.create as jest.Mock).mock.calls[0][0];
      const saved = payload.data.images.create[0].caption as string;

      const marks = saved.match(/\p{M}/gu) ?? [];
      expect(marks.length).toBeLessThanOrEqual(2);
    });

    it('bounds payload to 2000 chars before expensive regex/segment', async () => {

      const huge = 'x'.repeat(10_000);
      await service.create({
        ...baseDto,
        images: [
          { mediaFileId: 'mf-1', isMain: true, order: 0, caption: huge },
        ],
      });
      const payload = (prisma.product.create as jest.Mock).mock.calls[0][0];
      expect(
        (payload.data.images.create[0].caption as string).length,
      ).toBeLessThanOrEqual(200);
    });
  });

  describe('resolveExtraDays', () => {
    it('should return product extraDays if set', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        extraDays: 5,
        tags: [{ extraDays: 3 }],
      });

      const days = await service.resolveExtraDays('prod1');
      expect(days).toBe(5);
    });

    it('should fallback to max tag extraDays', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        extraDays: null,
        tags: [{ extraDays: 3 }, { extraDays: 7 }, { extraDays: null }],
      });

      const days = await service.resolveExtraDays('prod1');
      expect(days).toBe(7);
    });

    it('should return 0 if no extraDays anywhere', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        extraDays: null,
        tags: [],
      });

      const days = await service.resolveExtraDays('prod1');
      expect(days).toBe(0);
    });
  });

  describe('resolveShippingData', () => {
    const mockVariableProduct = {
      ...mockProduct,
      type: 'variable',
      basePrice: 0,
      weight: 0.5,
      width: 15,
      height: 10,
      length: 20,
      variations: [
        {
          id: 'var1',
          name: '28mm',
          price: 49.9,
          salePrice: 39.9,
          weight: 0.8,
          width: 20,
          height: 15,
          length: 25,
        },
        {
          id: 'var2',
          name: '32mm',
          price: 69.9,
          salePrice: null,
          weight: null,
          width: null,
          height: null,
          length: null,
        },
      ],
    };

    it('should use variation weight/dimensions when provided', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        mockVariableProduct,
      );

      const data = await service.resolveShippingData('prod1', 'var1');

      expect(data.weight).toBe(0.8);
      expect(data.width).toBe(20);
      expect(data.height).toBe(15);
      expect(data.length).toBe(25);
    });

    it('should fallback to parent weight/dimensions when variation has null', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        mockVariableProduct,
      );

      const data = await service.resolveShippingData('prod1', 'var2');

      expect(data.weight).toBe(0.5);
      expect(data.width).toBe(15);
      expect(data.height).toBe(10);
      expect(data.length).toBe(20);
    });

    it('should use variation salePrice when available', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        mockVariableProduct,
      );

      const data = await service.resolveShippingData('prod1', 'var1');

      expect(data.price).toBe(39.9);
    });

    it('should use variation price when no salePrice', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        mockVariableProduct,
      );

      const data = await service.resolveShippingData('prod1', 'var2');

      expect(data.price).toBe(69.9);
    });

    it('should use parent product data when no variationId', async () => {
      const simpleProduct = {
        ...mockProduct,
        type: 'simple',
        weight: 0.4,
        width: 12,
        height: 8,
        length: 18,
        salePrice: 39.9,
        variations: [],
      };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(simpleProduct);

      const data = await service.resolveShippingData('prod1');

      expect(data.weight).toBe(0.4);
      expect(data.width).toBe(12);
      expect(data.height).toBe(8);
      expect(data.length).toBe(18);
      expect(data.price).toBe(39.9);
    });

    it('should throw when variationId does not belong to product', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        mockVariableProduct,
      );

      await expect(
        service.resolveShippingData('prod1', 'var-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('variable publish guard (bug report — do not publish without price)', () => {
    it('REJECTS publishing variable with variation price=0', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.create({
          name: 'Gisela',
          description: 'Model Nude vs Normal',
          basePrice: 0,
          type: 'variable',
          isDraft: false,
          variations: [
            { name: 'Nude', price: 199, stock: 5 },
            { name: 'Normal', price: 0, stock: 5 },
          ],
        } as never),
      ).rejects.toThrow(/price/i);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('REJECTS publishing variable without any variations', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.create({
          name: 'Gisela',
          description: 'without variations',
          basePrice: 0,
          type: 'variable',
          isDraft: false,
          variations: [],
        } as never),
      ).rejects.toThrow(/variation/i);
    });

    it('ACCEPTS saving as draft even without price in variations', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-draft',
        type: 'variable',
        isDraft: true,
      });
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      await service.create({
        name: 'Variable draft',
        description: 'still building',
        basePrice: 0,
        type: 'variable',
        isDraft: true,
        variations: [
          { name: 'A', price: 0 },
          { name: 'B', price: 0 },
        ],
      } as never);

      expect(prisma.product.create).toHaveBeenCalled();
    });

    it('ACCEPTS publishing variable with ALL variations with price > 0', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-ok',
        type: 'variable',
      });
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      await service.create({
        name: 'Ok',
        description: 'price ok',
        basePrice: 0,
        type: 'variable',
        isDraft: false,
        variations: [
          { name: 'A', price: 49.9 },
          { name: 'B', price: 69.9 },
        ],
      } as never);

      expect(prisma.product.create).toHaveBeenCalled();
    });

    it('UPDATE: REJECTS unpublishing->publishing if any variation has price=0 in DB', async () => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod-1',
        type: 'variable',
        isDraft: true,
      });
      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([
        { name: 'A', price: 49.9 },
        { name: 'B', price: 0 },
      ]);

      await expect(
        service.update('prod-1', { isDraft: false } as never),
      ).rejects.toThrow(/price/i);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('UPDATE: REJECTS setting variations with price=0 when current isDraft=false', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod-1',
        type: 'variable',
        isDraft: false,
      });

      await expect(
        service.update('prod-1', {
          variations: [
            { name: 'A', price: 49.9 },
            { name: 'B', price: 0 },
          ],
        } as never),
      ).rejects.toThrow(/price/i);
    });

    it('UPDATE: ACCEPTS setting isDraft=true even with zeroed variations (unpublishes)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod-1',
        type: 'variable',
        isDraft: false,
      });
      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-1',
        isDraft: true,
      });

      await service.update('prod-1', {
        isDraft: true,
      } as never);

      expect(prisma.product.update).toHaveBeenCalled();
    });
  });

  describe('create with variations', () => {
    it('should create product and its variations', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-new',
        type: 'variable',
      });
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      await service.create({
        name: 'Variable Product',
        description: 'Has variations',
        basePrice: 0,
        type: 'variable',
        variations: [
          { name: '28mm', price: 49.9, stock: 10 },
          { name: '32mm', price: 69.9, stock: 5, sku: 'VAR-32' },
        ],
      });

      expect(prisma.productVariation.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            productId: 'prod-new',
            name: '28mm',
            price: 49.9,
            stock: 10,
          }),
          expect.objectContaining({
            productId: 'prod-new',
            name: '32mm',
            price: 69.9,
            stock: 5,
            sku: 'VAR-32',
          }),
        ],
      });
    });

    it('should persist attributeValueId when provided (drives variation label on front)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-model',
        type: 'variable',
      });
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });
      (prisma.attributeValue.findMany as jest.Mock).mockResolvedValue([
        { id: 'av-model-nude', value: 'Nude' },
        { id: 'av-model-normal', value: 'Normal' },
      ]);

      await service.create({
        name: 'Gisela',
        description: 'Model Nude vs Normal',
        basePrice: 0,
        type: 'variable',
        attributeValueIds: ['av-model-nude', 'av-model-normal'],
        variations: [
          {
            name: 'Nude',
            price: 199,
            stock: 5,
            attributeValueId: 'av-model-nude',
          },
          {
            name: 'Normal',
            price: 199,
            stock: 5,
            attributeValueId: 'av-model-normal',
          },
        ],
      });

      expect(prisma.productVariation.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            name: 'Nude',
            attributeValueId: 'av-model-nude',
          }),
          expect.objectContaining({
            name: 'Normal',
            attributeValueId: 'av-model-normal',
          }),
        ],
      });
    });

    it('should auto-sync variation.name from AttributeValue.value when linked (admin cannot desync)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-sync',
        type: 'variable',
      });
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.attributeValue.findMany as jest.Mock).mockResolvedValue([
        { id: 'av-model-nude', value: 'Nude' },
      ]);

      await service.create({
        name: 'Sync Test',
        description: 'admin tried to rename linked variation',
        basePrice: 0,
        type: 'variable',
        attributeValueIds: ['av-model-nude'],
        variations: [

          {
            name: 'Pink',
            price: 199,
            stock: 5,
            attributeValueId: 'av-model-nude',
          },
        ],
      });

      expect(prisma.productVariation.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            name: 'Nude',
            attributeValueId: 'av-model-nude',
          }),
        ],
      });
    });

    it('should persist multiple images per variation via junction table', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-img',
        type: 'variable',
      });
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([
        { id: 'v-new', name: 'Nude' },
      ]);
      (prisma.attributeValue.findMany as jest.Mock).mockResolvedValue([
        { id: 'av-model-nude', value: 'Nude' },
      ]);

      await service.create({
        name: 'Multi Image',
        description: 'variation with 3 images',
        basePrice: 0,
        type: 'variable',
        attributeValueIds: ['av-model-nude'],
        variations: [
          {
            name: 'Nude',
            price: 199,
            stock: 5,
            attributeValueId: 'av-model-nude',
            images: [
              { mediaFileId: 'mf-1', isMain: true, order: 0 },
              { mediaFileId: 'mf-2', isMain: false, order: 1 },
              { mediaFileId: 'mf-3', isMain: false, order: 2 },
            ],
          },
        ],
      });

      expect(prisma.productVariationImage.createMany).toHaveBeenCalledWith({
        data: [
          { variationId: 'v-new', mediaFileId: 'mf-1', isMain: true, order: 0 },
          {
            variationId: 'v-new',
            mediaFileId: 'mf-2',
            isMain: false,
            order: 1,
          },
          {
            variationId: 'v-new',
            mediaFileId: 'mf-3',
            isMain: false,
            order: 2,
          },
        ],
      });
    });

    it('should reject variation whose attributeValueId does not exist in DB', async () => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-x',
        type: 'variable',
      });

      (prisma.attributeValue.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.create({
          name: 'Bad',
          description: 'Links variation to non-existent AV',
          basePrice: 0,
          type: 'variable',
          attributeValueIds: ['av-own'],
          variations: [
            {
              name: 'Foreign',
              price: 199,
              stock: 5,
              attributeValueId: 'av-does-not-exist',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.productVariation.createMany).not.toHaveBeenCalled();
    });

    it('should auto-add attributeValueId from variation to product_attributes if not selected', async () => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-new',
        type: 'variable',
      });
      (prisma.attributeValue.findMany as jest.Mock).mockResolvedValue([
        { id: 'av-model-nude' },
      ]);
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.create({
        name: 'Gisela',
        description: 'desc',
        basePrice: 0,
        type: 'variable',

        attributeValueIds: [],
        variations: [
          {
            name: 'Nude',
            price: 199,
            stock: 5,
            attributeValueId: 'av-model-nude',
          },
        ],
      });

      expect(prisma.productAttribute.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ productId: 'prod-new', attributeValueId: 'av-model-nude' }],
          skipDuplicates: true,
        }),
      );
    });
  });

  describe('update stock creates audit log', () => {
    it('should create audit log when stock changes via product form', async () => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 50,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 30,
      });
      (prisma.stockAuditLog.create as jest.Mock).mockResolvedValue({});
      (prisma.stockAuditLog.findMany as jest.Mock).mockResolvedValue([]);

      await service.update('prod1', { stock: 30 }, 'admin1');

      expect(prisma.stockAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod1',
          quantityBefore: 50,
          quantityAfter: 30,
          delta: -20,
          reason: 'ADMIN_ADJUSTMENT',
          referenceId: 'admin1',
        }),
      });
    });

    it('should NOT create audit log when stock does not change', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 50,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);

      await service.update('prod1', { name: 'Renamed' }, 'admin1');

      expect(prisma.stockAuditLog.create).not.toHaveBeenCalled();
    });

    it('should persist admin note (free-text) when stock adjusted', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 50,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 48,
      });
      (prisma.stockAuditLog.create as jest.Mock).mockResolvedValue({});

      await service.update(
        'prod1',
        { stock: 48, stockAdjustmentNote: 'product damaged during shipping' },
        'admin1',
      );

      expect(prisma.stockAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          note: 'product damaged during shipping',
          reason: 'ADMIN_ADJUSTMENT',
        }),
      });
    });

    it('should NOT prune audit logs (maintains full history for audit)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 50,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 30,
      });
      (prisma.stockAuditLog.create as jest.Mock).mockResolvedValue({});

      (prisma.stockAuditLog.findMany as jest.Mock).mockResolvedValue([
        { id: 'old-1' },
        { id: 'old-2' },
        { id: 'old-3' },
      ]);

      await service.update('prod1', { stock: 30 }, 'admin1');

      expect(prisma.stockAuditLog.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('update with variations', () => {
    it('should upsert variations: update existing, create new, delete removed', async () => {

      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([
        { id: 'v1', productId: 'prod1', name: '28mm', price: 49.9, stock: 10 },
        { id: 'v2', productId: 'prod1', name: '32mm', price: 69.9, stock: 5 },
      ]);
      (prisma.productVariation.update as jest.Mock).mockResolvedValue({});
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.productVariation.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);

      await service.update('prod1', {
        variations: [
          { id: 'v1', name: '28mm', price: 59.9, stock: 15 },

          { name: '75mm', price: 99.9, stock: 3 },
        ],
      });

      expect(prisma.productVariation.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: expect.objectContaining({ name: '28mm', price: 59.9, stock: 15 }),
      });

      expect(prisma.productVariation.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['v2'] } },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.productVariation.deleteMany).not.toHaveBeenCalled();

      expect(prisma.productVariation.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            productId: 'prod1',
            name: '75mm',
            price: 99.9,
            stock: 3,
          }),
        ],
      });
    });

    it('should persist attributeValueId on both create-new and update-existing paths', async () => {
      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'v1',
          productId: 'prod1',
          name: 'Nude',
          price: 199,
          stock: 5,
          attributeValueId: null,
        },
      ]);
      (prisma.productVariation.update as jest.Mock).mockResolvedValue({});
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.attributeValue.findMany as jest.Mock).mockResolvedValue([
        { id: 'av-model-nude', value: 'Nude' },
        { id: 'av-model-normal', value: 'Normal' },
      ]);

      await service.update('prod1', {
        attributeValueIds: ['av-model-nude', 'av-model-normal'],
        variations: [
          {
            id: 'v1',
            name: 'Nude',
            price: 199,
            stock: 5,
            attributeValueId: 'av-model-nude',
          },
          {
            name: 'Normal',
            price: 199,
            stock: 5,
            attributeValueId: 'av-model-normal',
          },
        ],
      });

      expect(prisma.productVariation.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: expect.objectContaining({ attributeValueId: 'av-model-nude' }),
      });

      expect(prisma.productVariation.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            name: 'Normal',
            attributeValueId: 'av-model-normal',
          }),
        ],
      });
    });

    it('should auto-sync name on update path too (both update-existing and create-new)', async () => {
      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'v1',
          productId: 'prod1',
          name: 'Nude',
          price: 199,
          stock: 5,
          attributeValueId: 'av-model-nude',
        },
      ]);
      (prisma.productVariation.update as jest.Mock).mockResolvedValue({});
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.attributeValue.findMany as jest.Mock).mockResolvedValue([
        { id: 'av-model-nude', value: 'Nude' },
        { id: 'av-model-normal', value: 'Normal' },
      ]);

      await service.update('prod1', {
        attributeValueIds: ['av-model-nude', 'av-model-normal'],
        variations: [

          {
            id: 'v1',
            name: 'Hacked',
            price: 199,
            stock: 5,
            attributeValueId: 'av-model-nude',
          },
          {
            name: 'AlsoHacked',
            price: 199,
            stock: 5,
            attributeValueId: 'av-model-normal',
          },
        ],
      });

      expect(prisma.productVariation.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: expect.objectContaining({ name: 'Nude' }),
      });

      expect(prisma.productVariation.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ name: 'Normal' })],
      });
    });

    it('should reject update when incoming variation.id does not belong to the product (scope guard)', async () => {
      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([
        { id: 'v1', productId: 'prod1', name: 'Own', price: 10, stock: 5 },
      ]);
      (prisma.productAttribute.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.update('prod1', {
          variations: [
            {
              id: 'v-from-another-product',
              name: 'Foreign',
              price: 10,
              stock: 5,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.productVariation.update).not.toHaveBeenCalled();
      expect(prisma.productVariation.updateMany).not.toHaveBeenCalled();
    });

    it('should reject variation whose attributeValueId does not exist in DB on update', async () => {
      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.productAttribute.findMany as jest.Mock).mockResolvedValue([
        { attributeValueId: 'av-own' },
      ]);

      (prisma.attributeValue.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.update('prod1', {
          variations: [
            {
              name: 'Foreign',
              price: 199,
              stock: 5,
              attributeValueId: 'av-does-not-exist',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findBySlug includes variation.attributeValue.attribute (drives label)', () => {
    it('should request variations include with attributeValue.attribute', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        ...mockProduct,
        productCategories: [],
        brand: null,
        tags: [],
        images: [],
        variations: [],
        attributes: [],
        relatedProducts: [],
      });

      await service.findBySlug('warrior-miniature');

      const call = (prisma.product.findFirst as jest.Mock).mock.calls[0][0];
      expect(call.include.variations.include.attributeValue).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
          include: { attribute: true },
        }),
      );
    });
  });

  describe('create with categoryIds', () => {
    it('should create productCategory rows for each categoryId', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-new',
      });

      await service.create({
        name: 'Test Product',
        description: 'Desc',
        basePrice: 10,
        categoryIds: ['cat-1', 'cat-2'],
      } as any);

      expect((prisma as any).productCategory.createMany).toHaveBeenCalledWith({
        data: [
          { productId: 'prod-new', categoryId: 'cat-1', isPrimary: true },
          { productId: 'prod-new', categoryId: 'cat-2', isPrimary: false },
        ],
      });
    });

    it('should respect explicit primaryCategoryId', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-explicit-primary',
      });

      await service.create({
        name: 'Explicit Primary',
        description: 'Desc',
        basePrice: 10,
        categoryIds: ['cat-1', 'cat-2', 'cat-3'],
        primaryCategoryId: 'cat-2',
      } as any);

      expect((prisma as any).productCategory.createMany).toHaveBeenCalledWith({
        data: [
          {
            productId: 'prod-explicit-primary',
            categoryId: 'cat-1',
            isPrimary: false,
          },
          {
            productId: 'prod-explicit-primary',
            categoryId: 'cat-2',
            isPrimary: true,
          },
          {
            productId: 'prod-explicit-primary',
            categoryId: 'cat-3',
            isPrimary: false,
          },
        ],
      });
    });

    it('should throw BadRequestException when primaryCategoryId is not in categoryIds', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Invalid Primary',
          description: 'Desc',
          basePrice: 10,
          categoryIds: ['cat-1', 'cat-2'],
          primaryCategoryId: 'cat-99',
        } as any),
      ).rejects.toThrow('primaryCategoryId must be one of categoryIds');
    });
  });

  describe('findAll with category + descendants', () => {
    it('should filter by categoryId and all descendant IDs', async () => {
      mockCategoriesService.getDescendantIds.mockResolvedValue([
        'child-1',
        'child-2',
      ]);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 1, perPage: 10, categoryId: 'root-cat' });

      expect(mockCategoriesService.getDescendantIds).toHaveBeenCalledWith(
        'root-cat',
      );
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productCategories: {
              some: { categoryId: { in: ['root-cat', 'child-1', 'child-2'] } },
            },
          }),
        }),
      );
    });
  });

  describe('update with categoryIds', () => {
    it('should sync productCategory rows and mark first as primary by default', async () => {
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);

      await service.update('prod1', { categoryIds: ['cat-a', 'cat-b'] } as any);

      expect((prisma as any).productCategory.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'prod1' },
      });
      expect((prisma as any).productCategory.createMany).toHaveBeenCalledWith({
        data: [
          { productId: 'prod1', categoryId: 'cat-a', isPrimary: true },
          { productId: 'prod1', categoryId: 'cat-b', isPrimary: false },
        ],
      });
    });

    it('should respect explicit primaryCategoryId on update', async () => {
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);

      await service.update('prod1', {
        categoryIds: ['cat-a', 'cat-b', 'cat-c'],
        primaryCategoryId: 'cat-c',
      } as any);

      expect((prisma as any).productCategory.createMany).toHaveBeenCalledWith({
        data: [
          { productId: 'prod1', categoryId: 'cat-a', isPrimary: false },
          { productId: 'prod1', categoryId: 'cat-b', isPrimary: false },
          { productId: 'prod1', categoryId: 'cat-c', isPrimary: true },
        ],
      });
    });

    it('should throw BadRequestException on update when primaryCategoryId is not in categoryIds', async () => {
      await expect(
        service.update('prod1', {
          categoryIds: ['cat-a'],
          primaryCategoryId: 'cat-zzz',
        } as any),
      ).rejects.toThrow('primaryCategoryId must be one of categoryIds');
    });
  });

  describe('create with merchant fields (Google Merchant / Meta Catalog)', () => {
    it('should pass mpn, condition, googleCategory, color, material, salePriceStartDate, salePriceEndDate to prisma create', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-merchant',
        mpn: 'MPN-001',
        condition: 'new',
        googleCategoryId: 'gc-1253',
        colorId: 'color-gray',
        materialId: 'material-resin',
        salePriceStartDate: new Date('2026-05-01T00:00:00Z'),
        salePriceEndDate: new Date('2026-05-31T23:59:59Z'),
      });

      const startDate = new Date('2026-05-01T00:00:00Z');
      const endDate = new Date('2026-05-31T23:59:59Z');

      await service.create({
        name: 'Merchant Product',
        description: 'Product with merchant fields',
        basePrice: 49.9,
        mpn: 'MPN-001',
        condition: 'new',
        googleCategoryId: 'gc-1253',
        colorId: 'color-gray',
        materialId: 'material-resin',
        salePriceStartDate: startDate,
        salePriceEndDate: endDate,
      } as any);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mpn: 'MPN-001',
            condition: 'new',
            googleCategoryId: 'gc-1253',
            colorId: 'color-gray',
            materialId: 'material-resin',
            salePriceStartDate: startDate,
            salePriceEndDate: endDate,
          }),
        }),
      );
    });

    it('should default condition to "new" when not provided', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-default-cond',
      });

      await service.create({
        name: 'Default Condition',
        description: 'No condition provided',
        basePrice: 29.9,
      });

      const callData = (prisma.product.create as jest.Mock).mock.calls[0][0]
        .data;
      expect(callData.condition).toBeUndefined();
    });
  });

  describe('create variations without merchant fields (inherited from parent)', () => {
    it('should NOT pass color/material to variation create — variations inherit', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-var-merchant',
        type: 'variable',
      });
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.create({
        name: 'Variable Merchant',
        description: 'Variations inherit merchant fields from parent',
        basePrice: 0,
        type: 'variable',
        variations: [{ name: 'Red 28mm', price: 49.9 }],
      });

      const call = (prisma.productVariation.createMany as jest.Mock).mock
        .calls[0][0];
      expect(call.data[0]).not.toHaveProperty('color');
      expect(call.data[0]).not.toHaveProperty('material');
      expect(call.data[0]).toMatchObject({
        productId: 'prod-var-merchant',
        name: 'Red 28mm',
        price: 49.9,
      });
    });
  });

  describe('update with merchant FK ids', () => {
    it('should update merchant FK columns on existing product', async () => {
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        mpn: 'MPN-UPDATED',
        condition: 'refurbished',
        colorId: 'color-blue',
      });

      await service.update('prod1', {
        mpn: 'MPN-UPDATED',
        condition: 'refurbished',
        colorId: 'color-blue',
      } as any);

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mpn: 'MPN-UPDATED',
            condition: 'refurbished',
            color: { connect: { id: 'color-blue' } },
          }),
        }),
      );
    });
  });

  describe('bundle products', () => {
    const mockChildSimple = {
      id: 'child-simple',
      name: 'Child Simple',
      type: 'simple',
      basePrice: 50,
      salePrice: 40,
      isActive: true,
    };

    const mockChildVariable = {
      id: 'child-variable',
      name: 'Child Variable',
      type: 'variable',
      basePrice: 0,
      isActive: true,
      variations: [
        { id: 'var-a', name: 'Pose A', price: 30, salePrice: null },
        { id: 'var-b', name: 'Pose B', price: 35, salePrice: 28 },
      ],
    };

    it('should create a bundle product with components', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'bundle-1',
        type: 'bundle',
        bundleDiscount: 10,
        basePrice: 0,
        manageStock: false,
      });

      (prisma.bundleComponent as any).findMany.mockResolvedValue([
        { childProduct: mockChildSimple, childVariation: null, quantity: 2 },
        {
          childProduct: mockChildVariable,
          childVariation: mockChildVariable.variations[0],
          quantity: 1,
        },
      ]);
      (prisma.product.update as jest.Mock).mockResolvedValue({});

      await service.create({
        name: 'My Bundle',
        description: 'A bundle product',
        basePrice: 0,
        type: 'bundle',
        bundleDiscount: 10,
        bundleComponents: [
          { childProductId: 'child-simple', quantity: 2 },
          {
            childProductId: 'child-variable',
            childVariationId: 'var-a',
            quantity: 1,
          },
        ],
      } as any);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'bundle',
            bundleDiscount: 10,
            manageStock: false,
          }),
        }),
      );

      expect((prisma.bundleComponent as any).createMany).toHaveBeenCalledWith({
        data: [
          {
            parentProductId: 'bundle-1',
            childProductId: 'child-simple',
            childVariationId: undefined,
            quantity: 2,
            sortOrder: 0,
          },
          {
            parentProductId: 'bundle-1',
            childProductId: 'child-variable',
            childVariationId: 'var-a',
            quantity: 1,
            sortOrder: 1,
          },
        ],
      });
    });

    it('should reject bundle with no components', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Empty Bundle',
          description: 'No components',
          basePrice: 0,
          type: 'bundle',
          bundleComponents: [],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject bundle without bundleComponents field', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create({
          name: 'No Components Field',
          description: 'Missing components',
          basePrice: 0,
          type: 'bundle',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject bundle referencing itself', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'bundle-self',
        type: 'bundle',
      });

      await expect(
        service.create({
          name: 'Self Ref Bundle',
          description: 'References itself',
          basePrice: 0,
          type: 'bundle',
          bundleComponents: [{ childProductId: 'bundle-self', quantity: 1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should recalculate bundle basePrice from components', async () => {

      (prisma.bundleComponent as any).findMany.mockResolvedValue([
        { childProduct: mockChildSimple, childVariation: null, quantity: 2 },
        {
          childProduct: mockChildVariable,
          childVariation: mockChildVariable.variations[0],
          quantity: 1,
        },
      ]);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'bundle-1',
        bundleDiscount: 10,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue({});

      const price = await service.recalculateBundlePrice('bundle-1');

      expect(price).toBe(99);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'bundle-1' },
        data: { basePrice: 99, displayPrice: 99 },
      });
    });

    it('should recalculate with 0% discount', async () => {
      (prisma.bundleComponent as any).findMany.mockResolvedValue([
        {
          childProduct: { ...mockChildSimple, salePrice: null },
          childVariation: null,
          quantity: 1,
        },
      ]);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'bundle-no-disc',
        bundleDiscount: 0,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue({});

      const price = await service.recalculateBundlePrice('bundle-no-disc');

      expect(price).toBe(50);
    });

    it('should update bundle components (delete existing + create new)', async () => {
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'bundle-1',
        type: 'bundle',
      });
      (prisma.bundleComponent as any).findMany.mockResolvedValue([
        { childProduct: mockChildSimple, childVariation: null, quantity: 3 },
      ]);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'bundle-1',
        type: 'bundle',
        bundleDiscount: 5,
      });

      await service.update('bundle-1', {
        bundleComponents: [{ childProductId: 'child-simple', quantity: 3 }],
      } as any);

      expect((prisma.bundleComponent as any).deleteMany).toHaveBeenCalledWith({
        where: { parentProductId: 'bundle-1' },
      });
      expect((prisma.bundleComponent as any).createMany).toHaveBeenCalled();
    });
  });

  describe('draft products', () => {
    it('should create product as draft', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        isDraft: true,
      });

      await service.create({
        name: 'Draft Product',
        description: 'WIP',
        basePrice: 0,
        isDraft: true,
      } as any);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDraft: true }),
        }),
      );
    });
  });

  describe('findAll with admin flag', () => {
    it('should filter isActive+isDraft for storefront (default)', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 1, perPage: 10 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true, isDraft: false }),
        }),
      );
    });

    it('should NOT filter isActive/isDraft for admin', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 1, perPage: 10, admin: true });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.isActive).toBeUndefined();
      expect(call.where.isDraft).toBeUndefined();
    });

    it('should search by SKU', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 1, perPage: 10, search: 'WAR-001' });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      const orConditions = call.where.OR;
      expect(orConditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sku: { contains: 'WAR-001', mode: 'insensitive' },
          }),
        ]),
      );
    });
  });

  describe('resolveExtraDays with productCategories + inheritance', () => {
    it('should use inherited extraDays from category ancestor', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        extraDays: null,
        tags: [],
      });
      (prisma as any).productCategory.findMany.mockResolvedValue([
        {
          categoryId: 'child-cat',
          category: { id: 'child-cat', extraDays: null },
        },
      ]);
      mockCategoriesService.resolveInheritedField.mockResolvedValue(7);

      const days = await service.resolveExtraDays('prod1');

      expect(days).toBe(7);
      expect(mockCategoriesService.resolveInheritedField).toHaveBeenCalledWith(
        'child-cat',
        'extraDays',
      );
    });
  });

  describe('findAll — ordering (featured always first)', () => {
    beforeEach(() => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);
    });

    it('default sort should be alphabetical with featured first', async () => {
      await service.findAll({ page: 1, perPage: 10 });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([{ featured: 'desc' }, { name: 'asc' }]);
    });

    it('sort=alphabetical should order by featured desc then name asc', async () => {
      await service.findAll({ page: 1, perPage: 10, sort: 'alphabetical' });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([{ featured: 'desc' }, { name: 'asc' }]);
    });

    it('sort=price-asc should order by featured desc then displayPrice asc', async () => {
      await service.findAll({ page: 1, perPage: 10, sort: 'price-asc' });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([
        { featured: 'desc' },
        { displayPrice: 'asc' },
      ]);
    });

    it('sort=price-desc should order by featured desc then displayPrice desc', async () => {
      await service.findAll({ page: 1, perPage: 10, sort: 'price-desc' });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([
        { featured: 'desc' },
        { displayPrice: 'desc' },
      ]);
    });

    it('sort=recent should order by featured desc then createdAt desc', async () => {
      await service.findAll({ page: 1, perPage: 10, sort: 'recent' });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([
        { featured: 'desc' },
        { createdAt: 'desc' },
      ]);
    });

    it('should fall back to alphabetical when sort is invalid', async () => {
      await service.findAll({ page: 1, perPage: 10, sort: 'garbage' as any });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([{ featured: 'desc' }, { name: 'asc' }]);
    });

    it('admin without explicit sort defaults to recent (last created first)', async () => {
      await service.findAll({ page: 1, perPage: 10, admin: true });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([
        { featured: 'desc' },
        { createdAt: 'desc' },
      ]);
    });

    it('admin with explicit sort honors it (overrides admin default)', async () => {
      await service.findAll({
        page: 1,
        perPage: 10,
        admin: true,
        sort: 'alphabetical',
      });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([{ featured: 'desc' }, { name: 'asc' }]);
    });

    it('storefront without sort stays alphabetical (regression guard)', async () => {
      await service.findAll({ page: 1, perPage: 10 });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([{ featured: 'desc' }, { name: 'asc' }]);
    });

    it('sort=sold should order by featured desc then salesCount desc', async () => {
      await service.findAll({ page: 1, perPage: 10, sort: 'sold' });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([
        { featured: 'desc' },
        { salesCount: 'desc' },
      ]);
    });

    it('admin with sort=sold honors it (overrides admin recent default)', async () => {
      await service.findAll({
        page: 1,
        perPage: 10,
        admin: true,
        sort: 'sold',
      });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.orderBy).toEqual([
        { featured: 'desc' },
        { salesCount: 'desc' },
      ]);
    });
  });

  describe('findAll — featured filter', () => {
    beforeEach(() => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);
    });

    it('filters by featured=true', async () => {
      await service.findAll({ page: 1, perPage: 10, featured: true });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.featured).toBe(true);
    });

    it('ignores featured when not provided', async () => {
      await service.findAll({ page: 1, perPage: 10 });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.featured).toBeUndefined();
    });

    it('ignores featured=false (no-op, equivalent to undefined)', async () => {
      await service.findAll({ page: 1, perPage: 10, featured: false });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.featured).toBeUndefined();
    });
  });

  describe('findAll — type filter', () => {
    beforeEach(() => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);
    });

    it('filters by type=simple', async () => {
      await service.findAll({ page: 1, perPage: 10, type: 'simple' });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.type).toBe('simple');
    });

    it('filters by type=variable', async () => {
      await service.findAll({ page: 1, perPage: 10, type: 'variable' });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.type).toBe('variable');
    });

    it('filters by type=bundle', async () => {
      await service.findAll({ page: 1, perPage: 10, type: 'bundle' });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.type).toBe('bundle');
    });

    it('ignores type when not provided', async () => {
      await service.findAll({ page: 1, perPage: 10 });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.type).toBeUndefined();
    });

    it('ignores invalid type silently', async () => {
      await service.findAll({ page: 1, perPage: 10, type: 'bogus' as any });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.type).toBeUndefined();
    });
  });

  describe('findAll — stockStatus filter', () => {
    beforeEach(() => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);
    });

    it('in_stock: manageStock=false OR (manageStock=true AND stock>0)', async () => {
      await service.findAll({
        page: 1,
        perPage: 10,
        stockStatus: 'in_stock',
      });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.AND).toContainEqual({
        OR: [{ manageStock: false }, { manageStock: true, stock: { gt: 0 } }],
      });
    });

    it('out_of_stock: manageStock=true AND stock<=0', async () => {
      await service.findAll({
        page: 1,
        perPage: 10,
        stockStatus: 'out_of_stock',
      });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.AND).toContainEqual({
        manageStock: true,
        stock: { lte: 0 },
      });
    });

    it('low_stock: manageStock=true AND stock between 1..5', async () => {
      await service.findAll({
        page: 1,
        perPage: 10,
        stockStatus: 'low_stock',
      });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.AND).toContainEqual({
        manageStock: true,
        stock: { gt: 0, lte: 5 },
      });
    });

    it('ignores stockStatus when not provided', async () => {
      await service.findAll({ page: 1, perPage: 10 });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];

      const andGroups = (call.where.AND ?? []) as Array<
        Record<string, unknown>
      >;
      const stockEntry = andGroups.find(
        (g) => 'manageStock' in g || 'stock' in g,
      );
      expect(stockEntry).toBeUndefined();
    });

    it('ignores invalid stockStatus silently', async () => {
      await service.findAll({
        page: 1,
        perPage: 10,
        stockStatus: 'bogus' as any,
      });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      const andGroups = (call.where.AND ?? []) as Array<
        Record<string, unknown>
      >;
      const stockEntry = andGroups.find(
        (g) => 'manageStock' in g || 'stock' in g,
      );
      expect(stockEntry).toBeUndefined();
    });
  });

  describe('findAll — onSale filter', () => {
    beforeEach(() => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);
    });

    it('should not add onSale conditions when onSale is undefined', async () => {
      await service.findAll({ page: 1, perPage: 10 });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];

      expect(JSON.stringify(call.where)).not.toContain('salePrice');
    });

    it('should restrict to products with active sale when onSale=true', async () => {
      await service.findAll({ page: 1, perPage: 10, onSale: true });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      const andConditions = call.where.AND as any[];
      expect(Array.isArray(andConditions)).toBe(true);

      const onSaleGroup = andConditions.find(
        (a) =>
          Array.isArray(a?.OR) &&
          a.OR.some((c: any) => c.salePrice || c.variations?.some?.salePrice),
      );
      expect(onSaleGroup).toBeDefined();

      const simpleBranch = onSaleGroup.OR.find((c: any) => c.salePrice);
      expect(simpleBranch.salePrice).toEqual({ not: null });

      expect(simpleBranch.AND).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              { salePriceStartDate: null },
              { salePriceStartDate: { lte: expect.any(Date) } },
            ]),
          }),
          expect.objectContaining({
            OR: expect.arrayContaining([
              { salePriceEndDate: null },
              { salePriceEndDate: { gte: expect.any(Date) } },
            ]),
          }),
        ]),
      );

      const variableBranch = onSaleGroup.OR.find((c: any) => c.variations);
      expect(variableBranch).toEqual({
        type: 'variable',
        variations: { some: { salePrice: { not: null }, deletedAt: null } },
      });
    });

    it('should combine onSale with categoryId and priceMin/priceMax', async () => {
      mockCategoriesService.getDescendantIds.mockResolvedValue([]);

      await service.findAll({
        page: 1,
        perPage: 10,
        onSale: true,
        categoryId: 'cat-1',
        priceMin: 10,
        priceMax: 100,
      });

      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.productCategories).toBeDefined();
      const andConditions = call.where.AND as any[];
      expect(andConditions.length).toBeGreaterThanOrEqual(2);

      const priceGroup = andConditions.find((a) =>
        a?.OR?.some((c: any) => c.basePrice),
      );
      const saleGroup = andConditions.find((a) =>
        a?.OR?.some((c: any) => c.salePrice || c.variations),
      );
      expect(priceGroup).toBeDefined();
      expect(saleGroup).toBeDefined();
    });
  });

  describe('displayPrice sync', () => {
    it('create simple product should persist displayPrice = salePrice ?? basePrice', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        basePrice: 100,
        salePrice: 80,
      });

      await service.create({
        name: 'On Sale Mini',
        description: 'A miniature on sale with enough description',
        basePrice: 100,
        salePrice: 80,
      });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayPrice: 80 }),
        }),
      );
    });

    it('create simple product without salePrice should persist displayPrice = basePrice', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        basePrice: 49.9,
        salePrice: null,
      });

      await service.create({
        name: 'Regular Mini',
        description: 'Regular miniature without promotional price',
        basePrice: 49.9,
      });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayPrice: 49.9 }),
        }),
      );
    });

    it('create variable product should set displayPrice to min(variation salePrice ?? price)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'var-prod',
        type: 'variable',
        basePrice: 0,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue({});

      await service.create({
        name: 'Variable Mini',
        description: 'Variable product with multiple variations',
        basePrice: 0,
        type: 'variable',
        variations: [
          { name: 'v1', price: 60 },
          { name: 'v2', price: 80, salePrice: 50 },
          { name: 'v3', price: 70 },
        ],
      });

      const displayPriceUpdate = (
        prisma.product.update as jest.Mock
      ).mock.calls.find(
        (c) =>
          c[0]?.where?.id === 'var-prod' &&
          c[0]?.data?.displayPrice !== undefined,
      );
      expect(displayPriceUpdate).toBeDefined();
      expect(displayPriceUpdate[0].data.displayPrice).toBe(50);
    });

    it('bundle recalculation should also update displayPrice', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'bundle-1',
        type: 'bundle',
        bundleDiscount: 10,
        salePrice: null,
      });
      (prisma.bundleComponent.findMany as jest.Mock).mockResolvedValue([
        {
          quantity: 2,
          childProduct: { basePrice: 50, salePrice: null },
          childVariation: null,
        },
      ]);
      (prisma.product.update as jest.Mock).mockResolvedValue({});

      await service.recalculateBundlePrice('bundle-1');

      const updateCall = (prisma.product.update as jest.Mock).mock.calls.find(
        (c) => c[0].data?.displayPrice !== undefined,
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0].data.displayPrice).toBe(90);
    });
  });

  describe('Redis cache in findBySlug', () => {
    const mockSlug = 'warrior-miniature';
    const cacheKey = `cache:product:slug:${mockSlug}:v1`;

    const mockFullProduct = {
      ...mockProduct,
      productCategories: [],
      brand: { id: 'brand1', name: 'Arsenal' },
      tags: [],
      images: [],
      variations: [],
      attributes: [],
      relatedProducts: [],
    };

    it('cache hit returns without DB query', async () => {
      redis.getJson.mockResolvedValue(mockFullProduct);

      const result = await service.findBySlug(mockSlug);

      expect(result.slug).toBe(mockSlug);
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
      expect(redis.getJson).toHaveBeenCalledWith(cacheKey);
      expect(redis.setJson).not.toHaveBeenCalled();
    });

    it('cache miss: DB query + populates cache best-effort', async () => {
      redis.getJson.mockResolvedValue(null);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(
        mockFullProduct,
      );

      const result = await service.findBySlug(mockSlug);

      expect(result.slug).toBe(mockSlug);
      expect(prisma.product.findFirst).toHaveBeenCalledTimes(1);
      expect(redis.setJson).toHaveBeenCalledWith(
        cacheKey,
        expect.objectContaining({ slug: mockSlug }),
        600,
      );
    });

    it('graceful degradation: Redis error on getJson falls back to DB', async () => {
      redis.getJson.mockRejectedValue(new Error('Redis down'));
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(
        mockFullProduct,
      );

      const result = await service.findBySlug(mockSlug);

      expect(result.slug).toBe(mockSlug);
      expect(prisma.product.findFirst).toHaveBeenCalledTimes(1);
    });

    it('NotFoundException does not cache (only caches valid responses)', async () => {
      redis.getJson.mockResolvedValue(null);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(redis.setJson).not.toHaveBeenCalled();
    });

    it('setJson failure does not block response (best-effort)', async () => {
      redis.getJson.mockResolvedValue(null);
      redis.setJson.mockRejectedValue(new Error('Redis OOM'));
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(
        mockFullProduct,
      );

      const result = await service.findBySlug(mockSlug);
      expect(result.slug).toBe(mockSlug);
    });

    it('update invalidates current slug cache', async () => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        slug: 'old-slug',
      });
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        slug: 'old-slug',
        productCategories: [],
        images: [],
        variations: [],
        attributes: [],
      });

      await service.update('prod1', { name: 'Updated' });

      expect(redis.del).toHaveBeenCalledWith('cache:product:slug:old-slug:v1');
    });

    it('remove invalidates slug cache', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        slug: 'will-be-removed',
      });
      (prisma.product.delete as jest.Mock).mockResolvedValue({
        ...mockProduct,
        slug: 'will-be-removed',
      });

      await service.remove('prod1');

      expect(redis.del).toHaveBeenCalledWith(
        'cache:product:slug:will-be-removed:v1',
      );
    });

    it('remove of non-existent product does NOT call del (NotFoundException first)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('invalidate does not propagate error if redis.del fails', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        slug: 'any-slug',
      });
      (prisma.product.delete as jest.Mock).mockResolvedValue({
        ...mockProduct,
        slug: 'any-slug',
      });
      redis.del.mockRejectedValue(new Error('Redis down'));

      await expect(service.remove('prod1')).resolves.toBeDefined();
    });
  });

  describe('storefront sanitization — availableStock vs stock/reservedStock', () => {
    const productWithStock = {
      ...mockProduct,
      stock: 50,
      reservedStock: 7,
      productCategories: [],
      brand: { id: 'brand1', name: 'Arsenal' },
      tags: [],
      images: [],
      attributes: [],
      relatedProducts: [],
      variations: [
        {
          id: 'var1',
          name: 'Red',
          stock: 10,
          reservedStock: 3,
          deletedAt: null,
          attributeValue: null,
          images: [],
        },
        {
          id: 'var2',
          name: 'Blue',
          stock: 5,
          reservedStock: 0,
          deletedAt: null,
          attributeValue: null,
          images: [],
        },
      ],
    };

    it('findBySlug default (sanitize=true): exposes availableStock, omits stock/reservedStock', async () => {
      redis.getJson.mockResolvedValue(null);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(
        productWithStock,
      );

      const result: any = await service.findBySlug('warrior-miniature');

      expect(result.availableStock).toBe(50 - 7);
      expect(result).not.toHaveProperty('stock');
      expect(result).not.toHaveProperty('reservedStock');

      expect(result.variations[0].availableStock).toBe(10 - 3);
      expect(result.variations[0]).not.toHaveProperty('stock');
      expect(result.variations[0]).not.toHaveProperty('reservedStock');
      expect(result.variations[1].availableStock).toBe(5);
    });

    it('findBySlug sanitize=false (admin): maintains raw stock/reservedStock', async () => {
      redis.getJson.mockResolvedValue(null);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(
        productWithStock,
      );

      const result: any = await service.findBySlug('warrior-miniature', {
        sanitize: false,
      });

      expect(result.stock).toBe(50);
      expect(result.reservedStock).toBe(7);

      expect(result.variations[0].stock).toBe(10);
      expect(result.variations[0].reservedStock).toBe(3);
    });

    it('findById default (sanitize=true): same sanitization', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        productWithStock,
      );

      const result: any = await service.findById('prod1');

      expect(result.availableStock).toBe(43);
      expect(result).not.toHaveProperty('stock');
      expect(result).not.toHaveProperty('reservedStock');
    });

    it('findById sanitize=false (admin): maintains raw', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(
        productWithStock,
      );

      const result: any = await service.findById('prod1', { sanitize: false });

      expect(result.stock).toBe(50);
      expect(result.reservedStock).toBe(7);
    });

    it('findAll storefront (admin=false default): sanitized items', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        productWithStock,
      ]);
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      const result: any = await service.findAll({ page: 1, perPage: 10 });

      expect(result.data[0].availableStock).toBe(43);
      expect(result.data[0]).not.toHaveProperty('stock');
      expect(result.data[0]).not.toHaveProperty('reservedStock');
    });

    it('findAll admin=true: items maintain stock/reservedStock', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        productWithStock,
      ]);
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      const result: any = await service.findAll({
        page: 1,
        perPage: 10,
        admin: true,
      });

      expect(result.data[0].stock).toBe(50);
      expect(result.data[0].reservedStock).toBe(7);
    });

    it('findById sanitize=true (public) BLOCKS inactive product (BOLA/IDOR fix)', async () => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...productWithStock,
        isActive: false,
      });

      await expect(service.findById('prod1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('findById sanitize=true (public) BLOCKS draft (BOLA/IDOR fix)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...productWithStock,
        isDraft: true,
        isActive: true,
      });

      await expect(service.findById('prod1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('findById sanitize=false (admin) ALLOWS inactive/draft product', async () => {

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...productWithStock,
        isActive: false,
        isDraft: true,
      });

      const result: any = await service.findById('prod1', { sanitize: false });
      expect(result.id).toBe(productWithStock.id);
      expect(result.stock).toBe(50);
    });

    it('sanitization covers nested relations (Gemini R2 — bundleComponents/relatedProducts)', async () => {

      redis.getJson.mockResolvedValue(null);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        ...productWithStock,
        bundleComponents: [
          {
            id: 'bc1',
            quantity: 1,
            childProduct: {
              id: 'child1',
              name: 'Child',
              stock: 100,
              reservedStock: 25,
              manageStock: true,
              variations: [
                {
                  id: 'cv1',
                  stock: 30,
                  reservedStock: 5,
                  manageStock: true,
                },
              ],
            },
          },
        ],
        relatedProducts: [
          {
            id: 'rp1',
            type: 'related',

          },
        ],
      });

      const result: any = await service.findBySlug('warrior-miniature');

      const child = result.bundleComponents[0].childProduct;
      expect(child.availableStock).toBe(75);
      expect(child).not.toHaveProperty('stock');
      expect(child).not.toHaveProperty('reservedStock');

      expect(child.variations[0].availableStock).toBe(25);
      expect(child.variations[0]).not.toHaveProperty('stock');
      expect(child.variations[0]).not.toHaveProperty('reservedStock');
    });

    it('architectural GUARD: sanitized payload NEVER contains stock/reservedStock at any level (fail-open detection)', async () => {

      function findStockLeak(value: unknown, path = '$'): string | null {
        if (value === null || value === undefined) return null;
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const leak = findStockLeak(value[i], `${path}[${i}]`);
            if (leak) return leak;
          }
          return null;
        }
        if (typeof value !== 'object') return null;
        const obj = value as Record<string, unknown>;
        if ('stock' in obj || 'reservedStock' in obj) {
          return `${path} exposed stock/reservedStock`;
        }
        for (const [k, v] of Object.entries(obj)) {
          const leak = findStockLeak(v, `${path}.${k}`);
          if (leak) return leak;
        }
        return null;
      }

      redis.getJson.mockResolvedValue(null);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        ...productWithStock,
        bundleComponents: [
          {
            id: 'bc1',
            quantity: 1,
            childProduct: {
              ...productWithStock,
              id: 'child1',
              variations: [
                { id: 'cv1', stock: 30, reservedStock: 5, manageStock: true },
              ],
            },
            childVariation: {
              id: 'cv2',
              stock: 8,
              reservedStock: 1,
              manageStock: true,
            },
          },
        ],
      });

      const result = await service.findBySlug('warrior-miniature');
      const leak = findStockLeak(result);
      expect(leak).toBeNull();
    });

    it('manageStock=false: availableStock nullable (does not mislead client)', async () => {

      redis.getJson.mockResolvedValue(null);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        ...productWithStock,
        manageStock: false,
        stock: 0,
        reservedStock: 0,
        variations: [],
      });

      const result: any = await service.findBySlug('warrior-miniature');

      expect(result.availableStock).toBeNull();
      expect(result).not.toHaveProperty('stock');
      expect(result).not.toHaveProperty('reservedStock');
    });
  });
});
