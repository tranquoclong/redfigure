import { Test, TestingModule } from '@nestjs/testing';
import { BundlesService } from './bundles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BundlesService', () => {
  let service: BundlesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BundlesService,
        {
          provide: PrismaService,
          useValue: {
            bundle: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            product: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<BundlesService>(BundlesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('calculateBundlePrice', () => {
    it('should calculate price = sum of components × (1 - discount)', () => {
      const components = [
        { basePrice: 50, quantity: 1 },
        { basePrice: 30, quantity: 2 },
      ];
      const discount = 20;

      const price = service.calculateBundlePrice(components, discount);

      expect(price).toBe(88);
    });

    it('should return full price when discount is 0', () => {
      const components = [{ basePrice: 100, quantity: 1 }];

      const price = service.calculateBundlePrice(components, 0);

      expect(price).toBe(100);
    });

    it('should handle 100% discount', () => {
      const components = [{ basePrice: 100, quantity: 1 }];

      const price = service.calculateBundlePrice(components, 100);

      expect(price).toBe(0);
    });
  });

  describe('create', () => {
    it('should create bundle with auto-slug', async () => {
      (prisma.bundle.create as jest.Mock).mockResolvedValue({
        id: 'bundle1',
        name: 'Starter Pack',
        slug: 'starter-pack',
        discount: 15,
      });

      const result = await service.create({
        name: 'Starter Pack',
        discount: 15,
        items: [{ productId: 'prod1', quantity: 1 }],
      });

      expect(result.slug).toBe('starter-pack');
    });
  });

  describe('findBySlug', () => {
    it('should return bundle with items and calculated price', async () => {
      (prisma.bundle.findUnique as jest.Mock).mockResolvedValue({
        id: 'bundle1',
        name: 'Starter Pack',
        slug: 'starter-pack',
        discount: 20,
        items: [
          { productId: 'prod1', quantity: 1 },
          { productId: 'prod2', quantity: 2 },
        ],
      });
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        { id: 'prod1', basePrice: 50 },
        { id: 'prod2', basePrice: 30 },
      ]);

      const result = await service.findBySlug('starter-pack');

      expect(result.calculatedPrice).toBe(88);
    });
  });
});
