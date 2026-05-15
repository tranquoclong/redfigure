import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeCaption } from '../common/utils/sanitize-caption';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import sharp from 'sharp';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAX_DIMENSION = 4096;

const MAX_FRAMES = 50;

const MAX_TOTAL_PIXELS = 25_000_000;

const MAX_FILENAME_LENGTH = 255;

const MIME_TO_EXT: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function sanitizeFilename(raw: string): string {
  const stripped = raw

    .replace(/[\x00-\x1f\x7f-\x9f]/g, '')

    .replace(/[\u2000-\u200f\u2028-\u202f\u205f-\u206f\ufeff]/g, '')
    .replace(/["'<>\\/]/g, '');

  const trimmed = stripped.trim();

  const cleaned = [...trimmed].slice(0, MAX_FILENAME_LENGTH).join('');

  return cleaned.length > 0 ? cleaned : 'unnamed-file';
}

const IMAGE_VARIANTS = [
  { name: 'thumb', width: 200, quality: 80 },
  { name: 'card', width: 600, quality: 85 },
  { name: 'gallery', width: 1000, quality: 88 },
  { name: 'full', width: 1920, quality: 92 },
] as const;

interface MediaConfig {
  bucket: string;
  cdnUrl: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject('S3_CLIENT') private readonly s3Client: any,
    @Inject('MEDIA_CONFIG') private readonly config: MediaConfig,
    private readonly prisma: PrismaService,
  ) { }

  validateFile(filename: string, mimetype: string, size: number) {
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Accepted: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    const ext = extname(filename).toLowerCase();
    const allowedExts = MIME_TO_EXT[mimetype];
    if (!allowedExts || !allowedExts.includes(ext)) {
      throw new BadRequestException('File extension does not match MIME type');
    }
  }

  generateKey(originalname: string): string {
    const ext = extname(originalname).toLowerCase();
    const uuid = randomUUID();
    return `products/${uuid}${ext}`;
  }

  async processAndUpload(
    buffer: Buffer,
    originalname: string,
    mimetype: string,
    size: number,
    options?: { stripMetadata?: boolean },
  ) {
    this.validateFile(originalname, mimetype, size);

    const detectedMime = detectImageMime(buffer);
    if (!detectedMime) {
      throw new BadRequestException(
        'File content does not match any accepted image format',
      );
    }
    if (detectedMime !== mimetype) {
      throw new BadRequestException(
        `File content (${detectedMime}) does not match declared mime type (${mimetype})`,
      );
    }

    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;

    if (originalWidth <= 0 || originalHeight <= 0) {
      throw new BadRequestException('Invalid image dimensions detected');
    }

    if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
      throw new BadRequestException(
        `Image dimensions exceed maximum allowed (${MAX_DIMENSION}px)`,
      );
    }

    const pages = metadata.pages ?? 1;
    if (pages > MAX_FRAMES) {
      throw new BadRequestException(
        `Animated images cannot exceed ${MAX_FRAMES} frames`,
      );
    }

    const totalPixels = originalWidth * originalHeight * pages;
    if (totalPixels > MAX_TOTAL_PIXELS) {
      throw new BadRequestException(
        'Image resolution and frame count combination exceeds memory budget',
      );
    }

    const uuid = randomUUID();
    const urls: Record<string, string> = {};
    const strip = options?.stripMetadata === true;

    const uploadTasks = IMAGE_VARIANTS.map(async (variant) => {

      const targetWidth = Math.min(variant.width, originalWidth);

      let pipeline = sharp(buffer);
      if (strip) pipeline = pipeline.rotate();
      const webpBuffer = await pipeline
        .resize(targetWidth, undefined, { withoutEnlargement: true })
        .webp({ quality: variant.quality })
        .toBuffer();

      const key = `media/${uuid}/${variant.name}.webp`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: webpBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      urls[variant.name] = `${this.config.cdnUrl}/${key}`;
    });

    uploadTasks.push(
      (async () => {
        let pipeline = sharp(buffer);
        if (strip) pipeline = pipeline.rotate();
        const originalBuffer = await pipeline.webp({ quality: 95 }).toBuffer();

        const key = `media/${uuid}/original.webp`;

        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
            Body: originalBuffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );

        urls.original = `${this.config.cdnUrl}/${key}`;
      })(),
    );

    await Promise.all(uploadTasks);

    const mediaFile = await this.prisma.mediaFile.create({
      data: {
        filename: sanitizeFilename(originalname),
        mimeType: mimetype,
        size,
        thumb: urls.thumb,
        card: urls.card,
        gallery: urls.gallery,
        full: urls.full,
        original: urls.original,
        width: originalWidth,
        height: originalHeight,
      },
    });

    return mediaFile;
  }

  async deleteMediaFile(id: string) {
    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id },
    });

    if (!mediaFile) throw new NotFoundException('Media file not found');

    const cdnHost = this.getCdnHostname();
    const urls = [
      mediaFile.thumb,
      mediaFile.card,
      mediaFile.gallery,
      mediaFile.full,
      mediaFile.original,
    ].filter(Boolean) as string[];
    await Promise.all(
      urls.map(async (url) => {
        let key: string;
        try {
          const parsed = new URL(url);
          if (cdnHost && parsed.hostname !== cdnHost) {
            this.logger.warn(
              `S3 delete skipped: URL hostname ${parsed.hostname} differs from CDN ${cdnHost} (media ${id})`,
            );
            return;
          }
          key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
        } catch {

          return;
        }
        if (!key) return;
        try {
          await this.s3Client.send(
            new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
          );
        } catch (err) {
          this.logger.warn(
            `S3 delete failed for key ${key}: ${err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }),
    );

    await this.prisma.mediaFile.delete({ where: { id } });
  }

  private getCdnHostname(): string | null {
    try {
      return new URL(this.config.cdnUrl).hostname;
    } catch {
      return null;
    }
  }

  private buildMediaUpdateData(dto: {
    alt?: string;
    title?: string;
    description?: string;
    caption?: string;
    captionPresetId?: string | null;
  }): Record<string, string | null | undefined> {
    const data: Record<string, string | null | undefined> = {};
    if (dto.alt !== undefined) data.alt = dto.alt;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;

    if (dto.caption !== undefined) {
      data.caption = sanitizeCaption(dto.caption);
      if (dto.captionPresetId === undefined) {

        data.captionPresetId = null;
      }
    }
    if (dto.captionPresetId !== undefined) {
      data.captionPresetId = dto.captionPresetId;
    }
    return data;
  }

  async updateMediaMeta(
    id: string,
    dto: {
      alt?: string;
      title?: string;
      description?: string;
      caption?: string;

      captionPresetId?: string | null;
    },
  ) {
    const data = this.buildMediaUpdateData(dto);

    return this.prisma.mediaFile.update({
      where: { id },
      data,
      include: {
        captionPreset: { select: { id: true, name: true, text: true } },
      },
    });
  }

  async bulkUpdateMediaMeta(
    items: Array<{
      id: string;
      alt?: string;
      title?: string;
      description?: string;
      caption?: string;
      captionPresetId?: string | null;
    }>,
  ) {
    if (items.length === 0) {
      throw new BadRequestException('items must have at least 1 entry');
    }
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) {
        throw new BadRequestException(
          `id ${item.id} duplicate in bulk — collapse fields before sending`,
        );
      }
      seen.add(item.id);
    }

    const sorted = [...items].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );

    const ops = sorted.map((item) => {
      const { id, ...rest } = item;
      const data = this.buildMediaUpdateData(rest);
      return this.prisma.mediaFile.update({
        where: { id },
        data,
        include: {
          captionPreset: { select: { id: true, name: true, text: true } },
        },
      });
    });

    return this.prisma.$transaction(ops);
  }

  async findAllMedia(params: {
    page: number;
    perPage: number;
    search?: string;
  }) {
    const { page, perPage, search } = params;
    const skip = (page - 1) * perPage;

    const where: Record<string, any> = {};
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        include: {

          captionPreset: { select: { id: true, name: true, text: true } },
        },
      }),
      this.prisma.mediaFile.count({ where }),
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

  async findMediaById(id: string) {
    const media = await this.prisma.mediaFile.findUnique({
      where: { id },
      include: {
        captionPreset: { select: { id: true, name: true, text: true } },
      },
    });
    if (!media) throw new NotFoundException('Media file not found');
    return media;
  }

  async upload(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): Promise<{ url: string; key: string }> {
    this.validateFile(file.originalname, file.mimetype, file.size);

    const key = this.generateKey(file.originalname);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return { url: `${this.config.cdnUrl}/${key}`, key };
  }

  async delete(key: string) {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
    } catch (err: any) {
      if (err?.Code === 'NoSuchKey') return;
      throw err;
    }
  }
}
