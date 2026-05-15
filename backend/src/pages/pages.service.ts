import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { invalidateHomeBlocksCaches } from '../site-config/home-blocks.types';

const DEFAULT_PAGES = [
  {
    slug: 'about',
    title: 'About',
    metaDescription: 'About Red Figure - store of Figure.',
  },
  {
    slug: 'contact',
    title: 'Contact',
    metaDescription: 'Contact Red Figure.',
  },
  {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    metaDescription: 'Frequently Asked Questions about Figure.',
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    metaDescription: 'Privacy policy of Red Figure.',
  },
  {
    slug: 'terms',
    title: 'Terms of Use',
    metaDescription: 'Terms of use of Red Figure.',
  },
  {
    slug: 'returns',
    title: 'Shipping and Returns',
    metaDescription: 'Shipping and returns policy of Red Figure.',
  },
];

@Injectable()
export class PagesService implements OnModuleInit {
  private readonly logger = new Logger(PagesService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) { }

  async onModuleInit() {

    for (const page of DEFAULT_PAGES) {
      const exists = await this.prisma.page.findUnique({
        where: { slug: page.slug },
      });
      if (!exists) {
        await this.prisma.page.create({ data: page });
        this.logger.log(`Created default page: ${page.slug}`);
      }
    }
  }

  async findAll() {
    return this.prisma.page.findMany({
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
  }

  async findBySlug(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async update(
    slug: string,
    dto: {
      title?: string;
      content?: string;
      metaTitle?: string | null;
      metaDescription?: string | null;
      ogImage?: string | null;
      faqItems?: Array<{ question: string; answer: string }> | null;
    },
  ) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page not found');

    const data: Prisma.PageUpdateInput = {
      ...dto,
      faqItems:
        dto.faqItems === null
          ? Prisma.JsonNull
          : dto.faqItems === undefined
            ? undefined
            : dto.faqItems,
    };

    const updated = await this.prisma.page.update({ where: { slug }, data });

    if (slug === 'faq') {
      await invalidateHomeBlocksCaches(this.redis, this.logger);
    }

    return updated;
  }
}
