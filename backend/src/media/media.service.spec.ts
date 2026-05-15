import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

const rotateSpy = jest.fn();

let metadataResult: {
  width: number;
  height: number;
  format: string;
  pages?: number;
} = {
  width: 2000,
  height: 1500,
  format: 'jpeg',
};
jest.mock('sharp', () => {
  const mockSharp = jest.fn(() => {
    const chain: Record<string, jest.Mock> = {
      metadata: jest.fn().mockImplementation(async () => metadataResult),
      rotate: jest.fn(() => {
        rotateSpy();
        return chain;
      }),
      resize: jest.fn(() => chain),
      webp: jest.fn(() => chain),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('webp-data')),
    };
    return chain;
  });
  return mockSharp;
});

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const GIF_HEADER = Buffer.from('GIF89a');
const WEBP_PREFIX = Buffer.from('RIFF');
const WEBP_MARKER = Buffer.from('WEBP');
function webpBuffer(): Buffer {

  const size = Buffer.alloc(4);
  return Buffer.concat([WEBP_PREFIX, size, WEBP_MARKER]);
}

describe('MediaService', () => {
  let service: MediaService;
  let mockS3Client: any;
  let prisma: PrismaService;

  beforeEach(async () => {
    rotateSpy.mockClear();
    metadataResult = { width: 2000, height: 1500, format: 'jpeg' };
    mockS3Client = {
      send: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: 'S3_CLIENT', useValue: mockS3Client },
        {
          provide: 'MEDIA_CONFIG',
          useValue: {
            bucket: 'test-bucket',
            cdnUrl: 'https://cdn.test.com',
          },
        },
        {
          provide: PrismaService,
          useValue: {
            mediaFile: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('validateFile', () => {
    it('should accept valid image MIME types', () => {
      expect(() =>
        service.validateFile('photo.jpg', 'image/jpeg', 1024 * 1024),
      ).not.toThrow();
    });

    it('should reject non-image MIME types', () => {
      expect(() =>
        service.validateFile('doc.pdf', 'application/pdf', 1024),
      ).toThrow(BadRequestException);
    });

    it('should reject files exceeding 10MB', () => {
      expect(() =>
        service.validateFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024),
      ).toThrow(BadRequestException);
    });

    it('should reject mismatched extension and MIME type', () => {
      expect(() =>
        service.validateFile('fake.jpg', 'application/javascript', 1024),
      ).toThrow(BadRequestException);
    });
  });

  describe('processAndUpload', () => {
    const fakeBuffer = Buffer.concat([
      JPEG_HEADER,
      Buffer.from('fake-image-data'),
    ]);
    const mockMediaFile = {
      id: 'media1',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      thumb: 'https://cdn.test.com/media/uuid/thumb.webp',
      card: 'https://cdn.test.com/media/uuid/card.webp',
      gallery: 'https://cdn.test.com/media/uuid/gallery.webp',
      full: 'https://cdn.test.com/media/uuid/full.webp',
      original: 'https://cdn.test.com/media/uuid/original.webp',
      alt: null,
      title: null,
      description: null,
      width: 2000,
      height: 1500,
    };

    it('should convert image and generate 5 WebP variants (4 sized + original)', async () => {
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      const result = await service.processAndUpload(
        fakeBuffer,
        'photo.jpg',
        'image/jpeg',
        fakeBuffer.length,
      );

      expect(mockS3Client.send).toHaveBeenCalledTimes(5);
      expect(result.thumb).toContain('/thumb.webp');
      expect(result.card).toContain('/card.webp');
      expect(result.gallery).toContain('/gallery.webp');
      expect(result.full).toContain('/full.webp');
      expect(result.original).toContain('/original.webp');
    });

    it('should save MediaFile record with metadata', async () => {
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await service.processAndUpload(
        fakeBuffer,
        'photo.jpg',
        'image/jpeg',
        fakeBuffer.length,
      );

      expect(prisma.mediaFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          width: 2000,
          height: 1500,
        }),
      });
    });

    it('should read original image dimensions via Sharp', async () => {
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      const result = await service.processAndUpload(
        fakeBuffer,
        'photo.jpg',
        'image/jpeg',
        fakeBuffer.length,
      );

      expect(result.width).toBe(2000);
      expect(result.height).toBe(1500);
    });
  });

  describe('processAndUpload — stripMetadata', () => {
    const fakeBuffer = Buffer.concat([
      JPEG_HEADER,
      Buffer.from('fake-image-data'),
    ]);
    const mockMediaFile = {
      id: 'media1',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      thumb: 'https://cdn.test.com/media/uuid/thumb.webp',
      card: 'https://cdn.test.com/media/uuid/card.webp',
      gallery: 'https://cdn.test.com/media/uuid/gallery.webp',
      full: 'https://cdn.test.com/media/uuid/full.webp',
      original: 'https://cdn.test.com/media/uuid/original.webp',
      width: 2000,
      height: 1500,
    };

    it('default (no option): does not call .rotate() - preserves current behavior', async () => {
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await service.processAndUpload(
        fakeBuffer,
        'photo.jpg',
        'image/jpeg',
        fakeBuffer.length,
      );

      expect(rotateSpy).not.toHaveBeenCalled();
    });

    it('with stripMetadata=true: calls .rotate() in all 5 variants to remove EXIF', async () => {
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await service.processAndUpload(
        fakeBuffer,
        'photo.jpg',
        'image/jpeg',
        fakeBuffer.length,
        { stripMetadata: true },
      );

      expect(rotateSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('deleteMediaFile', () => {
    it('should delete 5 variants from S3 and record from DB', async () => {
      (prisma.mediaFile.findUnique as jest.Mock).mockResolvedValue({
        id: 'media1',
        thumb: 'https://cdn.test.com/media/abc/thumb.webp',
        card: 'https://cdn.test.com/media/abc/card.webp',
        gallery: 'https://cdn.test.com/media/abc/gallery.webp',
        full: 'https://cdn.test.com/media/abc/full.webp',
        original: 'https://cdn.test.com/media/abc/original.webp',
      });
      (prisma.mediaFile.delete as jest.Mock).mockResolvedValue({});

      await service.deleteMediaFile('media1');

      expect(mockS3Client.send).toHaveBeenCalledTimes(5);
      expect(prisma.mediaFile.delete).toHaveBeenCalledWith({
        where: { id: 'media1' },
      });
    });
  });

  describe('updateMediaMeta', () => {
    it('updates alt, title, description', async () => {
      (prisma.mediaFile.update as jest.Mock).mockResolvedValue({
        id: 'media1',
        alt: 'Elf warrior',
        title: 'Miniature warrior',
        description: 'An elf warrior in combat pose',
      });

      const result = await service.updateMediaMeta('media1', {
        alt: 'Elf warrior',
        title: 'Miniature warrior',
        description: 'An elf warrior in combat pose',
      });

      expect(prisma.mediaFile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'media1' },
          data: {
            alt: 'Elf warrior',
            title: 'Miniature warrior',
            description: 'An elf warrior in combat pose',
          },
        }),
      );
      expect(result.alt).toBe('Elf warrior');
    });

    it('sanitizes caption (bidi override removed)', async () => {
      (prisma.mediaFile.update as jest.Mock).mockResolvedValue({
        id: 'media1',
        caption: 'Illustrative image',
      });

      await service.updateMediaMeta('media1', {
        caption: 'Image\u202E illustrative',
      });

      expect(prisma.mediaFile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'media1' },

          data: { caption: 'Illustrative image', captionPresetId: null },
        }),
      );
    });

    it('allows clearing caption (empty string → null)', async () => {
      (prisma.mediaFile.update as jest.Mock).mockResolvedValue({
        id: 'media1',
        caption: null,
      });

      await service.updateMediaMeta('media1', { caption: '' });

      expect(prisma.mediaFile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'media1' },
          data: { caption: null, captionPresetId: null },
        }),
      );
    });

    it('sets captionPresetId when admin clicks preset (links live update)', async () => {
      (prisma.mediaFile.update as jest.Mock).mockResolvedValue({
        id: 'media1',
      });
      await service.updateMediaMeta('media1', {
        caption: 'Illustrative image',
        captionPresetId: 'preset-123',
      });
      expect(prisma.mediaFile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            caption: 'Illustrative image',
            captionPresetId: 'preset-123',
          },
        }),
      );
    });

    it('explicit null in captionPresetId removes link', async () => {
      (prisma.mediaFile.update as jest.Mock).mockResolvedValue({
        id: 'media1',
      });
      await service.updateMediaMeta('media1', { captionPresetId: null });
      expect(prisma.mediaFile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { captionPresetId: null },
        }),
      );
    });
  });

  describe('bulkUpdateMediaMeta', () => {
    beforeEach(() => {

      (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest
        .fn()
        .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    });

    it('updates N items in a single transaction', async () => {
      (prisma.mediaFile.update as jest.Mock).mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve({ id: where.id, alt: 'updated' }),
      );

      const result = await service.bulkUpdateMediaMeta([
        { id: 'media1', alt: 'A' },
        { id: 'media2', captionPresetId: 'preset-1' },
        { id: 'media3', caption: 'Image' },
      ]);

      expect(result).toHaveLength(3);
      expect(
        (prisma as unknown as { $transaction: jest.Mock }).$transaction,
      ).toHaveBeenCalledTimes(1);
      expect(prisma.mediaFile.update).toHaveBeenCalledTimes(3);
    });

    it('rejects empty array (no work to do)', async () => {
      await expect(service.bulkUpdateMediaMeta([])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects duplicate IDs (2 updates of the same media item would lead to non-deterministic results)', async () => {
      await expect(
        service.bulkUpdateMediaMeta([
          { id: 'media1', alt: 'A' },
          { id: 'media1', alt: 'B' },
        ]),
      ).rejects.toThrow(/duplicate/i);
    });

    it('sanitizes caption like updateMediaMeta does (bidi override removed)', async () => {
      (prisma.mediaFile.update as jest.Mock).mockResolvedValue({
        id: 'media1',
      });

      await service.bulkUpdateMediaMeta([
        { id: 'media1', caption: 'Image' },
      ]);

      expect(prisma.mediaFile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'media1' },
          data: expect.objectContaining({ caption: 'Image' }),
        }),
      );
    });

    it('sorts IDs before mapping updates (anti-deadlock — Postgres guarantees no deadlock if transactions acquire locks in the same order)', async () => {
      (prisma.mediaFile.update as jest.Mock).mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve({ id: where.id }),
      );

      await service.bulkUpdateMediaMeta([
        { id: 'media-c', alt: 'C' },
        { id: 'media-a', alt: 'A' },
        { id: 'media-b', alt: 'B' },
      ]);

      const calls = (prisma.mediaFile.update as jest.Mock).mock.calls;
      const idsInOrder = calls.map((c) => c[0].where.id);
      expect(idsInOrder).toEqual(['media-a', 'media-b', 'media-c']);
    });
  });

  describe('Magic byte validation (vs forged mimetype header)', () => {
    const mockMediaFile = {
      id: 'media1',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      thumb: 'url',
      card: 'url',
      gallery: 'url',
      full: 'url',
      original: 'url',
      width: 2000,
      height: 1500,
    };

    it('rejects buffer whose magic bytes do not match the declared mimetype', async () => {

      const fakeJpeg = Buffer.concat([PNG_HEADER, Buffer.from('rest of data')]);

      await expect(
        service.processAndUpload(
          fakeJpeg,
          'malware.jpg',
          'image/jpeg',
          fakeJpeg.length,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects buffer with no image magic bytes (arbitrary garbage)', async () => {
      const garbage = Buffer.from('not-an-image-at-all-just-plain-text');

      await expect(
        service.processAndUpload(
          garbage,
          'fake.jpg',
          'image/jpeg',
          garbage.length,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts JPEG with correct magic bytes', async () => {
      const realJpeg = Buffer.concat([JPEG_HEADER, Buffer.from('jpeg data')]);
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await expect(
        service.processAndUpload(
          realJpeg,
          'real.jpg',
          'image/jpeg',
          realJpeg.length,
        ),
      ).resolves.toBeDefined();
    });

    it('accepts PNG with correct magic bytes', async () => {
      const realPng = Buffer.concat([PNG_HEADER, Buffer.from('png data')]);
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await expect(
        service.processAndUpload(
          realPng,
          'real.png',
          'image/png',
          realPng.length,
        ),
      ).resolves.toBeDefined();
    });

    it('accepts WebP with correct magic bytes', async () => {
      const realWebp = Buffer.concat([webpBuffer(), Buffer.from('webp data')]);
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await expect(
        service.processAndUpload(
          realWebp,
          'real.webp',
          'image/webp',
          realWebp.length,
        ),
      ).resolves.toBeDefined();
    });

    it('accepts GIF with correct magic bytes', async () => {
      const realGif = Buffer.concat([GIF_HEADER, Buffer.from('gif data')]);
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await expect(
        service.processAndUpload(
          realGif,
          'real.gif',
          'image/gif',
          realGif.length,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('Pixel flood DoS protection', () => {
    const fakeBuffer = Buffer.concat([
      JPEG_HEADER,
      Buffer.from('fake-image-data'),
    ]);
    const mockMediaFile = {
      id: 'media1',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      thumb: 'url',
      card: 'url',
      gallery: 'url',
      full: 'url',
      original: 'url',
      width: 2000,
      height: 1500,
    };

    it('rejects image with dimensions above 4096px (image bomb)', async () => {

      metadataResult = { width: 50000, height: 50000, format: 'png' };
      const fakePng = Buffer.concat([PNG_HEADER, Buffer.from('bomb')]);

      await expect(
        service.processAndUpload(
          fakePng,
          'bomb.png',
          'image/png',
          fakePng.length,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts image within the 4096px limit', async () => {
      metadataResult = { width: 3840, height: 2160, format: 'jpeg' };
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await expect(
        service.processAndUpload(
          fakeBuffer,
          'normal.jpg',
          'image/jpeg',
          fakeBuffer.length,
        ),
      ).resolves.toBeDefined();
    });

    it('rejects GIF with too many frames (animation bomb)', async () => {

      metadataResult = { width: 10, height: 10, format: 'gif', pages: 50_000 };
      const fakeGif = Buffer.concat([
        GIF_HEADER,
        Buffer.from('bomb padding here'),
      ]);

      await expect(
        service.processAndUpload(
          fakeGif,
          'bomb.gif',
          'image/gif',
          fakeGif.length,
        ),
      ).rejects.toThrow(/frame/i);
    });

    it('rejects resolution x frames combination that would pass individual caps (composite OOM)', async () => {

      metadataResult = {
        width: 4096,
        height: 4096,
        format: 'webp',
        pages: 50,
      };
      const fakeWebp = Buffer.concat([
        webpBuffer(),
        Buffer.from('animated bomb'),
      ]);

      await expect(
        service.processAndUpload(
          fakeWebp,
          'bomb.webp',
          'image/webp',
          fakeWebp.length,
        ),
      ).rejects.toThrow(/memory/i);
    });

    it('accepts GIF with frames below limit', async () => {
      metadataResult = { width: 500, height: 500, format: 'gif', pages: 30 };
      const fakeGif = Buffer.concat([
        GIF_HEADER,
        Buffer.from('ok gif data padding'),
      ]);
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await expect(
        service.processAndUpload(
          fakeGif,
          'ok.gif',
          'image/gif',
          fakeGif.length,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('deleteMediaFile — robust URL parsing', () => {
    it('extracts key correctly via URL parse (not fragile string replace)', async () => {
      (prisma.mediaFile.findUnique as jest.Mock).mockResolvedValue({
        id: 'm1',
        thumb: 'https://cdn.test.com/media/abc123/thumb.webp',
        card: null,
        gallery: null,
        full: null,
        original: null,
      });
      (prisma.mediaFile.delete as jest.Mock).mockResolvedValue({});

      await service.deleteMediaFile('m1');

      const deleteCall = mockS3Client.send.mock.calls[0][0];
      expect(deleteCall.input.Key).toBe('media/abc123/thumb.webp');
    });

    it('ignores invalid URLs without crashing', async () => {
      (prisma.mediaFile.findUnique as jest.Mock).mockResolvedValue({
        id: 'm1',
        thumb: 'not-a-valid-url',
        card: null,
        gallery: null,
        full: null,
        original: null,
      });
      (prisma.mediaFile.delete as jest.Mock).mockResolvedValue({});

      await expect(service.deleteMediaFile('m1')).resolves.toBeUndefined();
      expect(prisma.mediaFile.delete).toHaveBeenCalled();
    });
  });

  describe('filename sanitization (anti XSS)', () => {
    const fakeBuffer = Buffer.concat([
      JPEG_HEADER,
      Buffer.from('fake-image-data'),
    ]);
    const mockMediaFile = {
      id: 'media1',
      filename: 'clean.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      thumb: 'url',
      card: 'url',
      gallery: 'url',
      full: 'url',
      original: 'url',
      width: 2000,
      height: 1500,
    };

    it('strips control characters + caps filename at 255 before saving', async () => {
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      const malicious = '\x00<script>alert(1)</script>photo.jpg';
      await service.processAndUpload(
        fakeBuffer,
        malicious,
        'image/jpeg',
        fakeBuffer.length,
      );

      const createCall = (prisma.mediaFile.create as jest.Mock).mock
        .calls[0][0];

      expect(createCall.data.filename).not.toContain('\x00');
      expect(createCall.data.filename.length).toBeLessThanOrEqual(255);
    });
  });

  describe('findAllMedia', () => {
    it('returns paginated media files', async () => {
      (prisma.mediaFile.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.mediaFile.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findAllMedia({ page: 1, perPage: 20 });

      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        perPage: 20,
        lastPage: 1,
      });
    });

    it('search by filename or alt', async () => {
      (prisma.mediaFile.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.mediaFile.count as jest.Mock).mockResolvedValue(0);

      await service.findAllMedia({ page: 1, perPage: 20, search: 'heroine' });

      expect(prisma.mediaFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { filename: { contains: 'heroine', mode: 'insensitive' } },
              { alt: { contains: 'heroine', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });
});
