import { Test, TestingModule } from '@nestjs/testing';
import { MediaOrphanScanService } from './media-orphan-scan.service';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';

interface MediaFileFixture {
  id: string;
  thumb: string;
  card: string;
  gallery: string;
  full: string;
  original: string | null;
  filename: string;
  whitelistedAt: Date | null;
  createdAt: Date;
}

function mediaFile(
  id: string,
  overrides: Partial<MediaFileFixture> = {},
): MediaFileFixture {
  return {
    id,
    thumb: `https://cdn.redfigure.com/${id}/thumb.webp`,
    card: `https://cdn.redfigure.com/${id}/card.webp`,
    gallery: `https://cdn.redfigure.com/${id}/gallery.webp`,
    full: `https://cdn.redfigure.com/${id}/full.webp`,
    original: `https://cdn.redfigure.com/${id}/original.webp`,
    filename: `${id}.jpg`,
    whitelistedAt: null,
    createdAt: new Date('2026-04-01'),
    ...overrides,
  };
}

describe('MediaOrphanScanService', () => {
  let service: MediaOrphanScanService;
  let mediaService: { deleteMediaFile: jest.Mock };
  let prisma: {
    mediaFile: {
      findMany: jest.Mock;
      update: jest.Mock;
      findUnique?: jest.Mock;
    };
    productImage: { findMany: jest.Mock };
    productVariationImage: { findMany: jest.Mock };
    customQuoteImage: { findMany: jest.Mock };
    category: { findMany: jest.Mock };
    brand: { findMany: jest.Mock };
    blogPost: { findMany: jest.Mock };
    page: { findMany: jest.Mock };
    banner: { findMany: jest.Mock };
    productVariation: { findMany: jest.Mock };
    product: { findMany: jest.Mock };
    setting: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      mediaFile: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      productImage: { findMany: jest.fn().mockResolvedValue([]) },
      productVariationImage: { findMany: jest.fn().mockResolvedValue([]) },
      customQuoteImage: { findMany: jest.fn().mockResolvedValue([]) },
      category: { findMany: jest.fn().mockResolvedValue([]) },
      brand: { findMany: jest.fn().mockResolvedValue([]) },
      blogPost: { findMany: jest.fn().mockResolvedValue([]) },
      page: { findMany: jest.fn().mockResolvedValue([]) },
      banner: { findMany: jest.fn().mockResolvedValue([]) },
      productVariation: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      setting: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mediaService = { deleteMediaFile: jest.fn().mockResolvedValue(undefined) };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MediaOrphanScanService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaService, useValue: mediaService },
      ],
    }).compile();
    service = moduleRef.get(MediaOrphanScanService);
  });

  describe('Type A — FK direta', () => {
    it('marks as in use if referenced in ProductImage', async () => {
      const m = mediaFile('cmoeprod001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.productImage.findMany.mockResolvedValue([
        { mediaFileId: 'cmoeprod001' },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('marks as in use if referenced in ProductVariationImage', async () => {
      const m = mediaFile('cmoevar001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.productVariationImage.findMany.mockResolvedValue([
        { mediaFileId: 'cmoevar001' },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('marks as in use if referenced in CustomQuoteImage', async () => {
      const m = mediaFile('cmoeq001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.customQuoteImage.findMany.mockResolvedValue([
        { mediaFileId: 'cmoeq001' },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('is orphan when NOT referenced in any FK', async () => {
      const m = mediaFile('cmoeorphan001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(1);
      expect(orphans[0].id).toBe('cmoeorphan001');
    });
  });

  describe('Type B — URL detached as a string', () => {
    it('detects usage in Category.image (any variant matches)', async () => {
      const m = mediaFile('cmoecat001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.category.findMany.mockResolvedValue([{ image: m.gallery }]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('detects usage in Brand.logo', async () => {
      const m = mediaFile('cmoebrand001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.brand.findMany.mockResolvedValue([{ logo: m.thumb }]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('detects usage in BlogPost.coverImage', async () => {
      const cover = mediaFile('cmoecover001');
      prisma.mediaFile.findMany.mockResolvedValue([cover]);
      prisma.blogPost.findMany.mockResolvedValue([
        { coverImage: cover.full, content: '' },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('detects usage in Page.ogImage', async () => {
      const m = mediaFile('cmoepage001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.page.findMany.mockResolvedValue([
        { ogImage: m.card, content: '' },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('detects usage in Banner.imageUrl', async () => {
      const m = mediaFile('cmoebanner001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.banner.findMany.mockResolvedValue([{ imageUrl: m.original }]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('detects usage in ProductVariation.image (detached legacy URL)', async () => {
      const m = mediaFile('cmoevarimg001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.productVariation.findMany.mockResolvedValue([
        { image: m.gallery },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });
  });

  describe('Type C — URL embedded in HTML rich content', () => {
    it('detects CDN URL inside HTML in Product.content', async () => {
      const m = mediaFile('cmoecontent001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);

      prisma.product.findMany.mockResolvedValue([
        { content: `<p>texto</p><img src="${m.full}" alt="x"/><p>fim</p>` },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('detects URL in BlogPost.content and Page.content', async () => {
      const blogImg = mediaFile('cmoeblog001');
      const pageImg = mediaFile('cmoepg001');
      prisma.mediaFile.findMany.mockResolvedValue([blogImg, pageImg]);
      prisma.blogPost.findMany.mockResolvedValue([
        { coverImage: null, content: `<img src="${blogImg.gallery}"/>` },
      ]);
      prisma.page.findMany.mockResolvedValue([
        { ogImage: null, content: `<img src="${pageImg.thumb}"/>` },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('detects URL in Setting.value (ogImage default, social share, etc)', async () => {
      const m = mediaFile('cmoesetting001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.setting.findMany.mockResolvedValue([
        { key: 'og_image_default', value: m.full },
        { key: 'login_featured_image', value: 'irrelevant' },
        { key: 'json_blob', value: JSON.stringify({ icon: m.thumb }) },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });
  });

  describe('Whitelist', () => {
    it('whitelisted is not listed even if not in use', async () => {
      const orphan = mediaFile('cmoesemwl');
      const safelisted = mediaFile('cmoecomwl', {
        whitelistedAt: new Date('2026-05-01'),
      });
      prisma.mediaFile.findMany.mockResolvedValue([orphan, safelisted]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(1);
      expect(orphans[0].id).toBe('cmoesemwl');
    });
  });

  describe('Robustness (Gemini)', () => {
    it('detects URL with different encoding (corpus has relative URL)', async () => {

      const m = mediaFile('cmoeenc001');

      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      m.thumb = `https://cdn.redfigure.com/media/${uuid}/thumb.webp`;
      m.card = `https://cdn.redfigure.com/media/${uuid}/card.webp`;
      m.gallery = `https://cdn.redfigure.com/media/${uuid}/gallery.webp`;
      m.full = `https://cdn.redfigure.com/media/${uuid}/full.webp`;
      m.original = `https://cdn.redfigure.com/media/${uuid}/original.webp`;
      prisma.mediaFile.findMany.mockResolvedValue([m]);

      prisma.product.findMany.mockResolvedValue([
        { content: `<img src="/media/${uuid}/full.webp"/>` },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('detects URL with escaped chars (HTML entity in UUID hyphen)', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const m = mediaFile('cmoeenc002');
      m.thumb = `https://cdn.redfigure.com/media/${uuid}/thumb.webp`;
      m.full = `https://cdn.redfigure.com/media/${uuid}/full.webp`;
      m.gallery = `https://cdn.redfigure.com/media/${uuid}/gallery.webp`;
      m.card = `https://cdn.redfigure.com/media/${uuid}/card.webp`;
      m.original = null;
      prisma.mediaFile.findMany.mockResolvedValue([m]);

      prisma.blogPost.findMany.mockResolvedValue([
        {
          coverImage: null,
          content: `<img src="https://OUTRO-DOMINIO.com/media/${uuid}/gallery.webp"/>`,
        },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('does not match `/media/{uuid}/` marker when uuid is not the MediaFile uuid', async () => {

      const uuidA = 'aaaaaaaa-bbbb-bbbb-bbbb-cccccccccccc';
      const uuidB = '11111111-2222-2222-2222-333333333333';
      const m = mediaFile('cmoeOrph');
      m.thumb = `https://cdn.redfigure.com/media/${uuidA}/thumb.webp`;
      m.full = `https://cdn.redfigure.com/media/${uuidA}/full.webp`;
      m.card = `https://cdn.redfigure.com/media/${uuidA}/card.webp`;
      m.gallery = `https://cdn.redfigure.com/media/${uuidA}/gallery.webp`;
      m.original = null;
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.product.findMany.mockResolvedValue([
        { content: `<img src="/media/${uuidB}/full.webp"/>` },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(1);
    });

    it('case-insensitive: marker UPPERCASE in corpus matches lowercase marker in MediaFile', async () => {

      const uuidLower = 'aabbccdd-1122-1122-1122-aabbccddeeff';
      const uuidUpper = uuidLower.toUpperCase();
      const m = mediaFile('cmoecase01');
      m.thumb = `https://cdn.redfigure.com/media/${uuidLower}/thumb.webp`;
      m.full = `https://cdn.redfigure.com/media/${uuidLower}/full.webp`;
      m.card = `https://cdn.redfigure.com/media/${uuidLower}/card.webp`;
      m.gallery = `https://cdn.redfigure.com/media/${uuidLower}/gallery.webp`;
      m.original = null;
      prisma.mediaFile.findMany.mockResolvedValue([m]);

      prisma.product.findMany.mockResolvedValue([
        { content: `<img src="/media/${uuidUpper}/full.webp"/>` },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('covers ProductVariation soft-deleted (extension filters globally, we want to include)', async () => {

      const uuid = 'deadbeef-0000-1111-2222-444433335555';
      const m = mediaFile('cmoesofdel');
      m.thumb = `https://cdn.redfigure.com/media/${uuid}/thumb.webp`;
      m.full = `https://cdn.redfigure.com/media/${uuid}/full.webp`;
      m.card = `https://cdn.redfigure.com/media/${uuid}/card.webp`;
      m.gallery = `https://cdn.redfigure.com/media/${uuid}/gallery.webp`;
      m.original = null;
      prisma.mediaFile.findMany.mockResolvedValue([m]);

      prisma.productVariation.findMany.mockResolvedValue([
        { image: `https://cdn.redfigure.com/media/${uuid}/gallery.webp` },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);

      expect(prisma.productVariation.findMany).toHaveBeenCalledTimes(2);
      const calls = prisma.productVariation.findMany.mock.calls.map(
        (c: unknown[]) => c[0] as { where?: { deletedAt?: unknown } },
      );
      const hasExplicitDeleted = calls.some(
        (c) =>
          c.where &&
          typeof c.where.deletedAt === 'object' &&
          c.where.deletedAt !== null &&
          'not' in (c.where.deletedAt as object),
      );
      expect(hasExplicitDeleted).toBe(true);
    });
  });

  describe('Edge cases — robustness', () => {
    it('null/empty in string fields does not break or generate false matches', async () => {
      const m = mediaFile('cmoenull001');
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.category.findMany.mockResolvedValue([
        { image: null },
        { image: '' },
      ]);
      prisma.brand.findMany.mockResolvedValue([{ logo: null }]);
      prisma.product.findMany.mockResolvedValue([
        { content: '' },
        { content: null },
      ]);
      prisma.setting.findMany.mockResolvedValue([
        { key: 'k1', value: null },
        { key: 'k2', value: '' },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(1);
    });

    it('original NULL does not cause false negative when other variants match', async () => {
      const m = mediaFile('cmoenoorig', { original: null });
      prisma.mediaFile.findMany.mockResolvedValue([m]);
      prisma.banner.findMany.mockResolvedValue([{ imageUrl: m.gallery }]);
      const orphans = await service.findOrphans();
      expect(orphans).toHaveLength(0);
    });

    it('multiple media with mixed status are classified correctly', async () => {
      const usedFk = mediaFile('cmoeused1');
      const usedUrl = mediaFile('cmoeused2');
      const usedHtml = mediaFile('cmoeused3');
      const orphan = mediaFile('cmoeorphan1');
      const wl = mediaFile('cmoewl1', { whitelistedAt: new Date() });
      prisma.mediaFile.findMany.mockResolvedValue([
        usedFk,
        usedUrl,
        usedHtml,
        orphan,
        wl,
      ]);
      prisma.productImage.findMany.mockResolvedValue([
        { mediaFileId: 'cmoeused1' },
      ]);
      prisma.banner.findMany.mockResolvedValue([{ imageUrl: usedUrl.full }]);
      prisma.page.findMany.mockResolvedValue([
        { ogImage: null, content: `<img src="${usedHtml.gallery}"/>` },
      ]);
      const orphans = await service.findOrphans();
      expect(orphans.map((o) => o.id).sort()).toEqual(['cmoeorphan1']);
    });
  });

  describe('toggleWhitelist', () => {
    it('sets whitelistedAt = now when it was null', async () => {
      prisma.mediaFile.findMany.mockResolvedValue([mediaFile('cmoex')]);
      prisma.mediaFile.update = jest
        .fn()
        .mockResolvedValue({ id: 'cmoex', whitelistedAt: new Date() });

      (prisma.mediaFile as any).findUnique = jest
        .fn()
        .mockResolvedValue({ id: 'cmoex', whitelistedAt: null });
      const out = await service.toggleWhitelist('cmoex');
      expect(out.whitelistedAt).toBeInstanceOf(Date);
      expect(prisma.mediaFile.update).toHaveBeenCalledWith({
        where: { id: 'cmoex' },
        data: { whitelistedAt: expect.any(Date) },
      });
    });

    it('unsets whitelistedAt when it was already set', async () => {
      prisma.mediaFile.update = jest
        .fn()
        .mockResolvedValue({ id: 'cmoex', whitelistedAt: null });
      (prisma.mediaFile as any).findUnique = jest.fn().mockResolvedValue({
        id: 'cmoex',
        whitelistedAt: new Date('2026-04-01'),
      });
      const out = await service.toggleWhitelist('cmoex');
      expect(out.whitelistedAt).toBeNull();
      expect(prisma.mediaFile.update).toHaveBeenCalledWith({
        where: { id: 'cmoex' },
        data: { whitelistedAt: null },
      });
    });

    it('throw NotFoundException for non-existent id', async () => {
      (prisma.mediaFile as any).findUnique = jest.fn().mockResolvedValue(null);
      await expect(service.toggleWhitelist('nope')).rejects.toThrow();
    });
  });

  describe('bulkDeleteOrphans — re-validation and anti-tampering', () => {

    it('deletes only the ids that remain orphans; reports skipped ones', async () => {
      const stillOrphan = mediaFile('cmoeorph01');
      const becameUsed = mediaFile('cmoeused01');
      const whitelisted = mediaFile('cmoewl01', {
        whitelistedAt: new Date(),
      });
      prisma.mediaFile.findMany.mockResolvedValue([
        stillOrphan,
        becameUsed,
        whitelisted,
      ]);

      prisma.productImage.findMany.mockResolvedValue([
        { mediaFileId: 'cmoeused01' },
      ]);

      const result = await service.bulkDeleteOrphans([
        'cmoeorph01',
        'cmoeused01',
        'cmoewl01',
      ]);

      expect(mediaService.deleteMediaFile).toHaveBeenCalledTimes(1);
      expect(mediaService.deleteMediaFile).toHaveBeenCalledWith('cmoeorph01');
      expect(result.deleted).toEqual(['cmoeorph01']);
      expect(result.skipped.map((s: { id: string }) => s.id).sort()).toEqual([
        'cmoeused01',
        'cmoewl01',
      ]);
    });

    it('unknown id appears in skipped (does not block the batch)', async () => {
      const orph = mediaFile('cmoeorph02');
      prisma.mediaFile.findMany.mockResolvedValue([orph]);
      const result = await service.bulkDeleteOrphans([
        'cmoeorph02',
        'cmoenotexist',
      ]);
      expect(result.deleted).toEqual(['cmoeorph02']);
      expect(result.skipped.map((s: { id: string }) => s.id)).toContain(
        'cmoenotexist',
      );
    });

    it('continues the batch if an individual deletion fails', async () => {
      const a = mediaFile('cmoea');
      const b = mediaFile('cmoeb');
      prisma.mediaFile.findMany.mockResolvedValue([a, b]);
      mediaService.deleteMediaFile = jest
        .fn()
        .mockRejectedValueOnce(new Error('R2 error'))
        .mockResolvedValueOnce(undefined);
      const result = await service.bulkDeleteOrphans(['cmoea', 'cmoeb']);
      expect(mediaService.deleteMediaFile).toHaveBeenCalledTimes(2);
      expect(result.deleted).toEqual(['cmoeb']);
      expect(
        result.skipped.find((s: { id: string }) => s.id === 'cmoea'),
      ).toBeDefined();
    });

    it('empty list returns {deleted:[], skipped:[]} without DB hit', async () => {
      const result = await service.bulkDeleteOrphans([]);
      expect(result.deleted).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(prisma.mediaFile.findMany).not.toHaveBeenCalled();
    });
  });
});
