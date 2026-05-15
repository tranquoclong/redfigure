import { Test, TestingModule } from '@nestjs/testing';
import { SeoService } from './seo.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SeoService', () => {
  let service: SeoService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeoService,
        {
          provide: PrismaService,
          useValue: {
            seoMeta: {
              upsert: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
            },
            product: { findMany: jest.fn() },
            category: { findMany: jest.fn() },
            tag: { findMany: jest.fn().mockResolvedValue([]) },
            brand: { findMany: jest.fn().mockResolvedValue([]) },
            blogPost: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<SeoService>(SeoService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('upsertMeta', () => {
    it('should create or update SEO meta for an entity', async () => {
      (prisma.seoMeta.upsert as jest.Mock).mockResolvedValue({
        id: 'seo1',
        entityType: 'product',
        entityId: 'prod1',
        title: 'Warrior Miniature - Buy Now',
        description: 'High quality 3D printed warrior',
      });

      const result = await service.upsertMeta({
        entityType: 'product',
        entityId: 'prod1',
        title: 'Warrior Miniature - Buy Now',
        description: 'High quality 3D printed warrior',
      });

      expect(result.title).toBe('Warrior Miniature - Buy Now');
      expect(prisma.seoMeta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entityType_entityId: { entityType: 'product', entityId: 'prod1' },
          },
        }),
      );
    });
  });

  describe('getMeta', () => {
    it('should return SEO meta for an entity', async () => {
      (prisma.seoMeta.findUnique as jest.Mock).mockResolvedValue({
        id: 'seo1',
        entityType: 'product',
        entityId: 'prod1',
        title: 'Custom Title',
      });

      const result = await service.getMeta('product', 'prod1');

      expect(result?.title).toBe('Custom Title');
    });

    it('should return null if no meta exists', async () => {
      (prisma.seoMeta.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getMeta('product', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('generateSitemap', () => {
    it('should generate sitemap XML with products and categories', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        {
          slug: 'warrior',
          updatedAt: new Date('2026-04-01'),
          images: [
            {
              mediaFile: {
                full: 'https://cdn.example.com/warrior.webp',
                alt: 'Warrior miniature',
                title: 'Warrior',
              },
            },
          ],
        },
      ]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([
        { slug: 'fantasy', updatedAt: new Date('2026-03-15') },
      ]);
      (prisma.blogPost.findMany as jest.Mock).mockResolvedValue([
        { slug: 'how-to-paint', updatedAt: new Date('2026-04-02') },
      ]);

      const xml = await service.generateSitemap('https://miniatures3d.com');

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset');
      expect(xml).toContain(
        'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
      );
      expect(xml).toContain('https://miniatures3d.com/p/warrior');
      expect(xml).toContain('<image:image>');
      expect(xml).toContain(
        '<image:loc>https://cdn.example.com/warrior.webp</image:loc>',
      );
      expect(xml).toContain('<image:caption>Warrior miniature</image:caption>');
      expect(xml).toContain('<image:title>Warrior</image:title>');
      expect(xml).toContain('https://miniatures3d.com/c/fantasy');
      expect(xml).toContain('https://miniatures3d.com/blog/how-to-paint');
    });

    it('should include static pages', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.blogPost.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.tag.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.brand.findMany as jest.Mock).mockResolvedValue([]);

      const xml = await service.generateSitemap('https://miniatures3d.com');

      expect(xml).toContain('https://miniatures3d.com/');
      expect(xml).toContain('https://miniatures3d.com/about');
      expect(xml).toContain('https://miniatures3d.com/contact');
    });
  });
});
