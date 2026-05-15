import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/products', priority: '0.9', changefreq: 'daily' },
  { path: '/blog', priority: '0.7', changefreq: 'weekly' },
  { path: '/about', priority: '0.4', changefreq: 'monthly' },
  { path: '/contact', priority: '0.4', changefreq: 'monthly' },
  { path: '/faq', priority: '0.4', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.2', changefreq: 'yearly' },
  { path: '/terms', priority: '0.2', changefreq: 'yearly' },
  { path: '/returns', priority: '0.2', changefreq: 'yearly' },
];

function escXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

@Injectable()
export class SeoService {
  constructor(private prisma: PrismaService) { }

  async upsertMeta(dto: {
    entityType: string;
    entityId: string;
    title?: string;
    description?: string;
    ogImage?: string;
    keywords?: string;
    canonical?: string;
  }) {
    return this.prisma.seoMeta.upsert({
      where: {
        entityType_entityId: {
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      },
      update: {
        title: dto.title,
        description: dto.description,
        ogImage: dto.ogImage,
        keywords: dto.keywords,
        canonical: dto.canonical,
      },
      create: dto,
    });
  }

  async getMeta(entityType: string, entityId: string) {
    return this.prisma.seoMeta.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
  }

  async generateSitemap(baseUrl: string): Promise<string> {
    const [products, categories, tags, brands, blogPosts] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true, isDraft: false },
        select: {
          slug: true,
          updatedAt: true,
          images: {
            include: {
              mediaFile: {
                select: { full: true, alt: true, title: true },
              },
            },

            orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
          },
        },
      }),
      this.prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.tag.findMany({
        where: { isActive: true },
        select: { slug: true },
      }),
      this.prisma.brand.findMany({
        where: { isActive: true },
        select: { slug: true },
      }),
      this.prisma.blogPost.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    const urls: string[] = [];

    for (const page of STATIC_PAGES) {
      urls.push(
        `  <url>\n    <loc>${baseUrl}${page.path}</loc>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`,
      );
    }

    for (const p of products) {
      const imageXml = p.images
        .map((img) => {
          const imgUrl = img.mediaFile?.full;
          if (!imgUrl || !imgUrl.startsWith('http')) return '';
          const caption = img.mediaFile?.alt || img.mediaFile?.title || '';
          const title = img.mediaFile?.title || '';
          let tag = `\n    <image:image>\n      <image:loc>${escXml(imgUrl)}</image:loc>`;
          if (caption)
            tag += `\n      <image:caption>${escXml(caption)}</image:caption>`;
          if (title)
            tag += `\n      <image:title>${escXml(title)}</image:title>`;
          tag += `\n    </image:image>`;
          return tag;
        })
        .filter(Boolean)
        .join('');

      urls.push(
        `  <url>\n    <loc>${baseUrl}/p/${p.slug}</loc>\n    <lastmod>${p.updatedAt.toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>${imageXml}\n  </url>`,
      );
    }

    for (const c of categories) {
      urls.push(
        `  <url>\n    <loc>${baseUrl}/c/${c.slug}</loc>\n    <lastmod>${c.updatedAt.toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
      );
    }

    for (const t of tags) {
      urls.push(
        `  <url>\n    <loc>${baseUrl}/t/${t.slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>`,
      );
    }

    for (const b of brands) {
      urls.push(
        `  <url>\n    <loc>${baseUrl}/m/${b.slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>`,
      );
    }

    for (const b of blogPosts) {
      urls.push(
        `  <url>\n    <loc>${baseUrl}/blog/${b.slug}</loc>\n    <lastmod>${b.updatedAt.toISOString().split('T')[0]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`,
      );
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      ...urls,
      '</urlset>',
    ].join('\n');
  }
}
