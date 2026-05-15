import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from './media.service';

const MEDIA_PATH_RE = /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;
const MEDIA_PATH_RE_GLOBAL = /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//gi;

function extractMediaMarker(url: string | undefined | null): string | null {
  if (typeof url !== 'string') return null;
  const m = url.match(MEDIA_PATH_RE);

  return m ? `/media/${m[1].toLowerCase()}/` : null;
}

@Injectable()
export class MediaOrphanScanService {
  private readonly logger = new Logger(MediaOrphanScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) { }

  async findOrphans() {
    const [
      mediaFiles,
      productImages,
      productVariationImages,
      customQuoteImages,
      categories,
      brands,
      blogPosts,
      pages,
      banners,
      productVariations,
      productVariationsDeleted,
      products,
      settings,
    ] = await Promise.all([
      this.prisma.mediaFile.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.productImage.findMany({
        select: { mediaFileId: true },
        distinct: ['mediaFileId'],
      }),
      this.prisma.productVariationImage.findMany({
        select: { mediaFileId: true },
        distinct: ['mediaFileId'],
      }),
      this.prisma.customQuoteImage.findMany({
        select: { mediaFileId: true },
        distinct: ['mediaFileId'],
      }),
      this.prisma.category.findMany({ select: { image: true } }),
      this.prisma.brand.findMany({ select: { logo: true } }),
      this.prisma.blogPost.findMany({
        select: { coverImage: true, content: true },
      }),
      this.prisma.page.findMany({
        select: { ogImage: true, content: true },
      }),
      this.prisma.banner.findMany({ select: { imageUrl: true } }),

      this.prisma.productVariation.findMany({ select: { image: true } }),
      this.prisma.productVariation.findMany({
        where: { deletedAt: { not: null } },
        select: { image: true },
      }),
      this.prisma.product.findMany({ select: { content: true } }),
      this.prisma.setting.findMany({ select: { value: true } }),
    ]);

    const fkSet = new Set<string>();
    for (const r of productImages) if (r.mediaFileId) fkSet.add(r.mediaFileId);
    for (const r of productVariationImages)
      if (r.mediaFileId) fkSet.add(r.mediaFileId);
    for (const r of customQuoteImages)
      if (r.mediaFileId) fkSet.add(r.mediaFileId);

    const corpusParts: string[] = [];
    const pushIfStr = (v: unknown) => {
      if (typeof v === 'string' && v.length > 0) corpusParts.push(v);
    };
    for (const r of categories) pushIfStr(r.image);
    for (const r of brands) pushIfStr(r.logo);
    for (const r of blogPosts) {
      pushIfStr(r.coverImage);
      pushIfStr(r.content);
    }
    for (const r of pages) {
      pushIfStr(r.ogImage);
      pushIfStr(r.content);
    }
    for (const r of banners) pushIfStr(r.imageUrl);
    for (const r of productVariations) pushIfStr(r.image);
    for (const r of productVariationsDeleted) pushIfStr(r.image);
    for (const r of products) pushIfStr(r.content);
    for (const r of settings) pushIfStr(r.value);
    const corpus = corpusParts.join('\n');

    const markersInUse = new Set<string>();
    for (const m of corpus.matchAll(MEDIA_PATH_RE_GLOBAL)) {
      markersInUse.add(`/media/${m[1].toLowerCase()}/`);
    }

    return mediaFiles.filter((m) => {
      if (m.whitelistedAt) return false;
      if (fkSet.has(m.id)) return false;
      const variants = [m.thumb, m.card, m.gallery, m.full, m.original].filter(
        (u): u is string => typeof u === 'string' && u.length > 0,
      );

      let foundMarker = false;
      for (const url of variants) {
        const marker = extractMediaMarker(url);
        if (!marker) continue;
        foundMarker = true;
        if (markersInUse.has(marker)) return false;
      }

      if (!foundMarker) {
        for (const url of variants) {
          if (corpus.includes(url)) return false;
        }
      }
      return true;
    });
  }

  async bulkDeleteOrphans(ids: string[]): Promise<{
    deleted: string[];
    skipped: { id: string; reason: string }[];
  }> {
    if (ids.length === 0) return { deleted: [], skipped: [] };

    const requestedSet = new Set(ids);
    const orphans = await this.findOrphans();
    const orphanIds = new Set(orphans.map((o) => o.id));

    const deleted: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const id of ids) {
      if (!orphanIds.has(id)) {
        skipped.push({
          id,
          reason: 'no longer orphan (in use, whitelisted, or not found)',
        });
        continue;
      }
      try {
        await this.mediaService.deleteMediaFile(id);
        deleted.push(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`bulkDeleteOrphans failed for ${id}: ${message}`);
        skipped.push({ id, reason: 'delete failed' });
      }
    }

    this.logger.log(
      `bulkDeleteOrphans: requested=${requestedSet.size} deleted=${deleted.length} skipped=${skipped.length}`,
    );

    return { deleted, skipped };
  }

  async toggleWhitelist(id: string) {
    const current = await this.prisma.mediaFile.findUnique({
      where: { id },
      select: { id: true, whitelistedAt: true },
    });
    if (!current) {
      throw new NotFoundException('Media file not found');
    }
    return this.prisma.mediaFile.update({
      where: { id },
      data: {
        whitelistedAt: current.whitelistedAt ? null : new Date(),
      },
    });
  }
}
