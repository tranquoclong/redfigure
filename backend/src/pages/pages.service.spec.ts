import { Test, TestingModule } from '@nestjs/testing';
import { PagesService } from './pages.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException } from '@nestjs/common';

describe('PagesService', () => {
  let service: PagesService;
  let prisma: any;

  const mockPage = {
    id: 'page1',
    slug: 'about',
    title: 'About',
    content: '<p>About us</p>',
    metaTitle: null,
    metaDescription: 'About the store',
    ogImage: null,
    faqItems: null,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      page: {
        findMany: jest.fn().mockResolvedValue([mockPage]),
        findUnique: jest.fn().mockResolvedValue(mockPage),
        update: jest.fn().mockResolvedValue(mockPage),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RedisService,
          useValue: { del: jest.fn().mockResolvedValue(1) },
        },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
  });

  describe('findAll', () => {
    it('should return all pages with summary fields', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockPage]);
      expect(prisma.page.findMany).toHaveBeenCalledWith({
        orderBy: { title: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          metaTitle: true,
          metaDescription: true,
          updatedAt: true,
        },
      });
    });
  });

  describe('findBySlug', () => {
    it('should return a page by slug', async () => {
      const result = await service.findBySlug('about');
      expect(result).toEqual(mockPage);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.page.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a page by slug', async () => {
      const dto = { title: 'About', content: '<p>Updated</p>' };
      await service.update('about', dto);

      expect(prisma.page.update).toHaveBeenCalledWith({
        where: { slug: 'about' },
        data: dto,
      });
    });

    it('should throw NotFoundException if page not found', async () => {
      prisma.page.findUnique.mockResolvedValue(null);
      await expect(
        service.update('nonexistent', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update SEO fields', async () => {
      const dto = {
        metaTitle: 'Custom Title',
        metaDescription: 'Custom description',
        ogImage: 'https://cdn.example.com/og.jpg',
      };
      await service.update('about', dto);
      expect(prisma.page.update).toHaveBeenCalledWith({
        where: { slug: 'about' },
        data: dto,
      });
    });

    it('should update faqItems as JSON', async () => {
      const dto = {
        faqItems: [{ question: 'Q?', answer: 'A' }],
      };
      await service.update('faq', dto);
      expect(prisma.page.update).toHaveBeenCalledWith({
        where: { slug: 'faq' },
        data: dto,
      });
    });
  });
});
