import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { DropboxService } from './dropbox.service';
import { MediaService } from '../media/media.service';
import { SettingsService } from '../settings/settings.service';
import { DropboxPathsDto, UpdateDropboxSettingsDto } from './dto/dropbox.dto';

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

@Controller('api/v1/dropbox')
export class DropboxController {
  private readonly logger = new Logger(DropboxController.name);

  constructor(
    private readonly dropboxService: DropboxService,
    private readonly mediaService: MediaService,
    private readonly settingsService: SettingsService,
  ) { }

  @Roles('ADMIN')
  @Get('root-path')
  async getRootPath() {
    const rootPath =
      (await this.settingsService.get('dropbox_root_path')) ?? '';
    return { data: { rootPath } };
  }

  @Roles('ADMIN')
  @Get('browse')
  async browse(@Query('path') path = '') {
    const result = await this.dropboxService.listFolder(path);
    return { data: result };
  }

  @Roles('ADMIN')
  @Get('preview')
  async preview(@Query('path') path: string) {
    if (!path) throw new BadRequestException('path is required');
    const link = await this.dropboxService.getTemporaryLink(path);
    return { data: { link } };
  }

  @Roles('ADMIN')
  @Post('thumbnails')
  async thumbnails(@Body() dto: DropboxPathsDto) {

    const results = await this.dropboxService.getThumbnailsBatch(dto.paths);
    return { data: results };
  }

  @Roles('ADMIN')
  @Post('download')
  async download(@Body() dto: DropboxPathsDto) {
    const mediaFiles: any[] = [];
    for (const filePath of dto.paths) {
      const filename = filePath.split('/').pop() ?? 'image.jpg';
      try {
        const buffer = await this.dropboxService.downloadFile(filePath);
        const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
        const mimetype = EXT_TO_MIME[ext] ?? 'image/jpeg';

        const mf = await this.mediaService.processAndUpload(
          buffer,
          filename,
          mimetype,
          buffer.length,
        );
        mediaFiles.push(mf);
      } catch (err) {
        this.logger.error(
          `Failed to download/process "${filename}": ${err instanceof Error ? err.message : err}`,
        );
        throw new BadRequestException(
          `Failed to process "${filename}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      }
    }

    return { data: mediaFiles };
  }

  @Roles('ADMIN')
  @Put('settings')
  async saveSettings(@Body() dto: UpdateDropboxSettingsDto) {
    const promises: Promise<void>[] = [];

    if (dto.accessToken) {
      promises.push(
        this.settingsService.set(
          'dropbox_access_token',
          this.settingsService.encrypt(dto.accessToken),
        ),
      );
    }
    if (dto.refreshToken) {
      promises.push(
        this.settingsService.set(
          'dropbox_refresh_token',
          this.settingsService.encrypt(dto.refreshToken),
        ),
      );
    }
    if (dto.appKey) {
      promises.push(this.settingsService.set('dropbox_app_key', dto.appKey));
    }
    if (dto.appSecret) {
      promises.push(
        this.settingsService.set(
          'dropbox_app_secret',
          this.settingsService.encrypt(dto.appSecret),
        ),
      );
    }
    if (dto.rootPath !== undefined) {
      promises.push(
        this.settingsService.set('dropbox_root_path', dto.rootPath),
      );
    }

    await Promise.all(promises);
    return { data: { message: 'Dropbox settings saved' } };
  }
}
