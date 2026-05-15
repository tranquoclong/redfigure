import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    title: string;
    content: string;
    authorId: string;
    excerpt?: string;
    coverImage?: string;
  }) {
    const slug = slugify(dto.title, { lower: true });

    const existing = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('A post with this title already exists');
    }

    return this.prisma.blogPost.create({
      data: {
        title: dto.title,
        slug,
        content: dto.content,
        excerpt: dto.excerpt,
        coverImage: dto.coverImage,
        authorId: dto.authorId,
      },
    });
  }

  async findAllPublished(params: { page: number; perPage: number }) {
    const { page, perPage } = params;
    const skip = (page - 1) * perPage;

    const [data, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.blogPost.count({ where: { isPublished: true } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async findAll() {
    return this.prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async update(
    id: string,
    dto: {
      title?: string;
      content?: string;
      excerpt?: string;
      coverImage?: string;
      featured?: boolean;
    },
  ) {
    const data: Record<string, any> = { ...dto };
    if (dto.title) {
      data.slug = slugify(dto.title, { lower: true });
    }
    return this.prisma.blogPost.update({ where: { id }, data });
  }

  async publish(id: string) {
    return this.prisma.blogPost.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
    });
  }

  async unpublish(id: string) {
    return this.prisma.blogPost.update({
      where: { id },
      data: { isPublished: false },
    });
  }

  async remove(id: string) {
    return this.prisma.blogPost.update({
      where: { id },
      data: { isPublished: false },
    });
  }
}
