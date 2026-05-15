import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import { AiProductService } from './ai-product.service';
import { SkuService } from './sku.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AiGenerateDto } from './dto/ai-generate.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { DropboxService } from '../dropbox/dropbox.service';

function assertStringOrUndefined(
  value: unknown,
  name: string,
): asserts value is string | undefined {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${name} must be a single string`);
  }
}

function parseFiniteFloat(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

const MAX_MEDIA_FETCH_BYTES = 20 * 1024 * 1024;

async function fetchWithSizeLimit(
  url: string,
  maxBytes: number,
): Promise<Buffer> {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) {
    throw new BadRequestException(
      `Failed to fetch from CDN: ${url} (${response.status})`,
    );
  }
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new BadRequestException(
      `CDN asset exceeds max size (${maxBytes} bytes)`,
    );
  }
  if (!response.body) {
    throw new BadRequestException('Empty response body from CDN');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > maxBytes) {
      await reader.cancel();
      throw new BadRequestException(
        `CDN asset exceeds max size (${maxBytes} bytes)`,
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

@Controller('api/v1/products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly aiProductService: AiProductService,
    private readonly skuService: SkuService,
    private readonly dropboxService: DropboxService,
    private readonly prisma: PrismaService,
  ) { }

  @Public()
  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('tagId') tagId?: string,
    @Query('search') search?: string,
    @Query('attributes') attributes?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('featured') featured?: string,
    @Query('onSale') onSale?: string,
    @Query('sort') sort?: string,
  ) {

    assertStringOrUndefined(categoryId, 'categoryId');
    assertStringOrUndefined(brandId, 'brandId');
    assertStringOrUndefined(tagId, 'tagId');
    assertStringOrUndefined(search, 'search');
    assertStringOrUndefined(attributes, 'attributes');
    assertStringOrUndefined(priceMin, 'priceMin');
    assertStringOrUndefined(priceMax, 'priceMax');
    assertStringOrUndefined(featured, 'featured');
    assertStringOrUndefined(onSale, 'onSale');
    assertStringOrUndefined(sort, 'sort');

    if (typeof search === 'string' && search.length > 100) {
      throw new BadRequestException('search term too long');
    }

    const parsedPerPage = Math.max(
      1,
      Math.min(parseInt(perPage, 10) || 20, 100),
    );
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

    const allowedSorts = [
      'alphabetical',
      'price-asc',
      'price-desc',
      'recent',
      'sold',
    ] as const;
    type SortOption = (typeof allowedSorts)[number];
    const sortOption = allowedSorts.includes(sort as SortOption)
      ? (sort as SortOption)
      : undefined;

    return await this.productsService.findAll({
      page: parsedPage,
      perPage: parsedPerPage,
      categoryId,
      brandId,
      tagId,
      search,
      attributeValueIds: attributes ? attributes.split(',') : undefined,
      priceMin: parseFiniteFloat(priceMin),
      priceMax: parseFiniteFloat(priceMax),
      featured: featured === 'true' ? true : undefined,
      onSale: onSale === 'true' ? true : undefined,
      sort: sortOption,
    });
  }

  @Roles('ADMIN')
  @Get('admin')
  async findAllAdmin(
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('type') type?: string,
    @Query('stockStatus') stockStatus?: string,
    @Query('featured') featured?: string,
    @Query('sort') sort?: string,
  ) {
    assertStringOrUndefined(search, 'search');
    assertStringOrUndefined(categoryId, 'categoryId');
    assertStringOrUndefined(brandId, 'brandId');
    assertStringOrUndefined(type, 'type');
    assertStringOrUndefined(stockStatus, 'stockStatus');
    assertStringOrUndefined(featured, 'featured');
    assertStringOrUndefined(sort, 'sort');

    if (typeof search === 'string' && search.length > 100) {
      throw new BadRequestException('search term too long');
    }

    const parsedPerPage = Math.max(
      1,
      Math.min(parseInt(perPage, 10) || 20, 100),
    );
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

    const allowedSorts = [
      'alphabetical',
      'price-asc',
      'price-desc',
      'recent',
      'sold',
    ] as const;
    type SortOption = (typeof allowedSorts)[number];
    const sortOption = allowedSorts.includes(sort as SortOption)
      ? (sort as SortOption)
      : undefined;

    const allowedTypes = ['simple', 'variable', 'bundle'] as const;
    type TypeOption = (typeof allowedTypes)[number];
    const typeOption = allowedTypes.includes(type as TypeOption)
      ? (type as TypeOption)
      : undefined;

    const allowedStock = ['in_stock', 'out_of_stock', 'low_stock'] as const;
    type StockOption = (typeof allowedStock)[number];
    const stockOption = allowedStock.includes(stockStatus as StockOption)
      ? (stockStatus as StockOption)
      : undefined;

    return await this.productsService.findAll({
      page: parsedPage,
      perPage: parsedPerPage,
      search,
      categoryId,
      brandId,
      type: typeOption,
      stockStatus: stockOption,
      featured: featured === 'true' ? true : undefined,
      sort: sortOption,
      admin: true,
    });
  }

  @Roles('ADMIN')
  @Post('ai-generate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FilesInterceptor('images', 2))
  async aiGenerate(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: AiGenerateDto,
  ) {
    let images: Buffer[] = [];
    let mimeTypes: string[] = [];

    if (dto.mediaFileIds) {

      let ids: string[];
      try {
        const parsed: unknown = JSON.parse(dto.mediaFileIds);
        if (
          !Array.isArray(parsed) ||
          !parsed.every((i) => typeof i === 'string')
        ) {
          throw new Error('not an array of strings');
        }
        ids = parsed;
      } catch {
        throw new BadRequestException(
          'mediaFileIds must be a JSON array of strings',
        );
      }
      if (!ids.length) {
        throw new BadRequestException('mediaFileIds must not be empty');
      }
      const mediaFiles = await this.prisma.mediaFile.findMany({
        where: { id: { in: ids } },
      });
      if (!mediaFiles.length) {
        throw new BadRequestException('No media files found for given IDs');
      }

      const cdnUrl = process.env.CDN_URL;
      if (!cdnUrl) {
        throw new BadRequestException('CDN_URL not configured');
      }
      const expectedHost = new URL(cdnUrl).hostname;

      const mediaMap = new Map(mediaFiles.map((mf) => [mf.id, mf]));
      for (const id of ids) {
        const mf = mediaMap.get(id);
        if (!mf) continue;
        const url = mf.full || mf.gallery || mf.card;
        if (!url) continue;
        let parsedHost: string;
        try {
          parsedHost = new URL(url).hostname;
        } catch {
          throw new BadRequestException(`Invalid media URL for id ${id}`);
        }
        if (parsedHost !== expectedHost) {
          throw new BadRequestException(
            `Media URL hostname mismatch (expected ${expectedHost}, got ${parsedHost})`,
          );
        }

        const buffer = await fetchWithSizeLimit(url, MAX_MEDIA_FETCH_BYTES);
        images.push(buffer);
        mimeTypes.push('image/webp');
      }
    }

    if (!images.length && files?.length) {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      for (const file of files) {
        if (!allowedMimes.includes(file.mimetype)) {
          throw new BadRequestException(
            `Invalid image type: ${file.mimetype}. Allowed: ${allowedMimes.join(', ')}`,
          );
        }
      }
      images = files.map((f) => f.buffer);
      mimeTypes = files.map((f) => f.mimetype);
    }

    if (!images.length) {
      throw new BadRequestException('At least 1 image is required');
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: dto.brandId },
      select: { name: true },
    });
    if (!brand) {
      throw new BadRequestException('Brand not found');
    }

    const result = await this.aiProductService.generate({
      images,
      mimeTypes,
      name: dto.name,
      brandName: brand.name,
      hint: dto.hint,
    });

    return {
      data: {
        ...result,
        brandId: dto.brandId,
        collectionAttributeValueId: dto.collectionValueId,
      },
    };
  }

  @Roles('ADMIN')
  @Get('next-sku')
  async nextSku(@Query('brandId') brandId: string) {
    if (!brandId) {
      throw new BadRequestException('brandId is required');
    }
    const sku = await this.skuService.previewNextSku(brandId);
    return { data: { sku } };
  }

  @Public()
  @Get(':slugOrId')
  async findBySlugOrId(
    @Param('slugOrId') slugOrId: string,

    @CurrentUser() user?: { id: string; role?: string },
  ) {
    const sanitize = user?.role !== 'ADMIN';

    if (/^c[a-z0-9]{24,}$/.test(slugOrId)) {
      return await this.productsService.findById(slugOrId, { sanitize });
    }
    return await this.productsService.findBySlug(slugOrId, { sanitize });
  }

  @Public()
  @Get(':id/delivery-info')
  async getDeliveryInfo(@Param('id') id: string) {
    const extraDays = await this.productsService.resolveExtraDays(id);
    return { baseDays: 3, extraDays, totalDays: 3 + extraDays };
  }

  @Roles('ADMIN')
  @Get(':id/stock-audit')
  async getStockAudit(
    @Param('id') id: string,
    @Query('page') pageRaw?: string,
    @Query('perPage') perPageRaw?: string,
  ) {

    const page = Math.min(1000, Math.max(1, parseInt(pageRaw ?? '1', 10) || 1));
    const perPage = Math.max(
      1,
      Math.min(100, parseInt(perPageRaw ?? '50', 10) || 50),
    );
    return this.productsService.findStockAudit(id, { page, perPage });
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateProductDto) {

    if (dto.brandId && !dto.sku) {
      const autoSku = await this.skuService.getSkuForProduct(dto.brandId);
      if (autoSku) dto.sku = autoSku;
    }

    const product = await this.productsService.create(dto);

    if (dto.brandId && product.sku) {
      await this.skuService
        .commitSku(dto.brandId, product.sku)
        .catch((err) =>
          this.logger.warn(`Failed to commit SKU counter: ${err.message}`),
        );
    }

    if (dto.dropboxFolderPath && dto.renameDropboxFolder && product.sku) {
      const parentDir = dto.dropboxFolderPath.split('/').slice(0, -1).join('/');
      const originalName = dto.dropboxFolderPath.split('/').pop();
      const newPath = `${parentDir}/${product.sku} ${originalName}`;

      this.dropboxService
        .renameFolder(dto.dropboxFolderPath, newPath)
        .catch((err) =>
          this.logger.warn(`Failed to rename Dropbox folder: ${err.message}`),
        );
    }

    return product;
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: { id: string },
  ) {
    return await this.productsService.update(id, dto, user.id);
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return { message: 'Product deleted successfully' };
  }
}
