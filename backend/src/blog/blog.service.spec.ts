import { Test, TestingModule } from '@nestjs/testing';
import { BlogService } from './blog.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('BlogService', () => {
  let service: BlogService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        {
          provide: PrismaService,
          useValue: {
            blogPost: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<BlogService>(BlogService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const mockPost = {
    id: 'post1',
    title: 'How to Paint Miniatures',
    slug: 'how-to-paint-miniatures',
    excerpt: 'A beginner guide',
    content: '<p>Start with a primer...</p>',
    coverImage: 'https://cdn.example.com/cover.jpg',
    authorId: 'admin1',
    isPublished: true,
    featured: false,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create a blog post with auto-slug', async () => {
      (prisma.blogPost.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.blogPost.create as jest.Mock).mockResolvedValue(mockPost);

      const result = await service.create({
        title: 'How to Paint Miniatures',
        content: '<p>Start with a primer...</p>',
        authorId: 'admin1',
      });

      expect(result.slug).toBe('how-to-paint-miniatures');
    });

    it('should throw ConflictException for duplicate slug', async () => {
      (prisma.blogPost.findUnique as jest.Mock).mockResolvedValue(mockPost);

      await expect(
        service.create({
          title: 'How to Paint Miniatures',
          content: 'content',
          authorId: 'admin1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllPublished', () => {
    it('should return only published posts with pagination', async () => {
      (prisma.blogPost.findMany as jest.Mock).mockResolvedValue([mockPost]);
      (prisma.blogPost.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAllPublished({ page: 1, perPage: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.blogPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: true },
        }),
      );
    });
  });

  describe('findBySlug', () => {
    it('should return a published post by slug', async () => {
      (prisma.blogPost.findUnique as jest.Mock).mockResolvedValue(mockPost);

      const result = await service.findBySlug('how-to-paint-miniatures');

      expect(result.title).toBe('How to Paint Miniatures');
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      (prisma.blogPost.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('publish', () => {
    it('should set isPublished to true and publishedAt', async () => {
      (prisma.blogPost.update as jest.Mock).mockResolvedValue({
        ...mockPost,
        isPublished: true,
        publishedAt: expect.any(Date),
      });

      await service.publish('post1');

      expect(prisma.blogPost.update).toHaveBeenCalledWith({
        where: { id: 'post1' },
        data: { isPublished: true, publishedAt: expect.any(Date) },
      });
    });
  });

  describe('unpublish', () => {
    it('should set isPublished to false', async () => {
      (prisma.blogPost.update as jest.Mock).mockResolvedValue({
        ...mockPost,
        isPublished: false,
      });

      await service.unpublish('post1');

      expect(prisma.blogPost.update).toHaveBeenCalledWith({
        where: { id: 'post1' },
        data: { isPublished: false },
      });
    });
  });
});
