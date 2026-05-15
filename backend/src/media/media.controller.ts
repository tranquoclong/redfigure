import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { MediaOrphanScanService } from './media-orphan-scan.service';
import { UpdateMediaDto } from './dto/update-media.dto';
import { BulkUpdateMediaDto } from './dto/bulk-update-media.dto';
import { BulkDeleteOrphansDto } from './dto/bulk-delete-orphans.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Roles('ADMIN')
@Controller('api/v1/media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly orphanScan: MediaOrphanScanService,
  ) {}

  @Get('orphan-scan')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  async scanOrphans() {
    return { data: await this.orphanScan.findOrphans() };
  }

  @Post('orphan-scan/bulk-delete')
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  async bulkDeleteOrphans(@Body() dto: BulkDeleteOrphansDto) {
    return { data: await this.orphanScan.bulkDeleteOrphans(dto.ids) };
  }

  @Patch(':id/whitelist')
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  async toggleWhitelist(@Param('id') id: string) {
    return { data: await this.orphanScan.toggleWhitelist(id) };
  }

  @Post('upload')
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 200, ttl: 3_600_000 },
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return await this.mediaService.processAndUpload(
      file.buffer,
      file.originalname,
      file.mimetype,
      file.size,
    );
  }

  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
    @Query('search') search?: string,
  ) {
    return await this.mediaService.findAllMedia({
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
      search,
    });
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.mediaService.findMediaById(id);
  }

  @Put('bulk')
  @Throttle({
    short: { limit: 30, ttl: 60_000 },
  })
  async bulkUpdateMeta(@Body() dto: BulkUpdateMediaDto) {
    return { data: await this.mediaService.bulkUpdateMediaMeta(dto.items) };
  }

  @Put(':id')
  @Throttle({
    short: { limit: 60, ttl: 1000 },
    medium: { limit: 200, ttl: 10000 },
  })
  async updateMeta(@Param('id') id: string, @Body() dto: UpdateMediaDto) {
    return await this.mediaService.updateMediaMeta(id, dto);
  }

  @Delete(':id')
  @Throttle({
    short: { limit: 60, ttl: 1000 },
    medium: { limit: 600, ttl: 10000 },
  })
  async delete(@Param('id') id: string) {
    await this.mediaService.deleteMediaFile(id);
    return { message: 'Media file deleted' };
  }
}
