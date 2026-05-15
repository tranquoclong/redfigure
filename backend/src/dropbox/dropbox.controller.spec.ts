import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DropboxController } from './dropbox.controller';
import { DropboxService } from './dropbox.service';
import { MediaService } from '../media/media.service';
import { SettingsService } from '../settings/settings.service';
import { DropboxPathsDto } from './dto/dropbox.dto';
import { BadRequestException } from '@nestjs/common';

describe('DropboxController', () => {
  let controller: DropboxController;

  const mockDropboxService = {
    listFolder: jest.fn(),
    getTemporaryLink: jest.fn(),
    downloadFile: jest.fn(),
  };

  const mockMediaService = {
    processAndUpload: jest.fn(),
  };

  const mockSettingsService = {
    get: jest.fn(),
    set: jest.fn(),
    encrypt: jest.fn((v: string) => `enc:${v}`),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DropboxController],
      providers: [
        { provide: DropboxService, useValue: mockDropboxService },
        { provide: MediaService, useValue: mockMediaService },
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    controller = module.get<DropboxController>(DropboxController);
    jest.clearAllMocks();
  });

  describe('GET /dropbox/browse', () => {
    it('It should list folders and images.', async () => {
      mockDropboxService.listFolder.mockResolvedValue({
        path: '/Root',
        folders: [{ name: 'Sub', path: '/Root/Sub' }],
        images: [{ name: 'img.jpg', path: '/Root/img.jpg' }],
      });

      const result = await controller.browse('/Root');

      expect(result).toEqual({
        data: {
          path: '/Root',
          folders: [{ name: 'Sub', path: '/Root/Sub' }],
          images: [{ name: 'img.jpg', path: '/Root/img.jpg' }],
        },
      });
    });

    it('It should use the root when path is not provided.', async () => {
      mockDropboxService.listFolder.mockResolvedValue({
        path: '',
        folders: [],
        images: [],
      });

      await controller.browse('');

      expect(mockDropboxService.listFolder).toHaveBeenCalledWith('');
    });
  });

  describe('GET /dropbox/preview', () => {
    it('It should return a temporary link.', async () => {
      mockDropboxService.getTemporaryLink.mockResolvedValue(
        'https://dl.dropbox.com/temp/x.jpg',
      );

      const result = await controller.preview('/Root/x.jpg');

      expect(result).toEqual({
        data: { link: 'https://dl.dropbox.com/temp/x.jpg' },
      });
    });

    it('It should throw BadRequestException if path is not provided.', async () => {
      await expect(controller.preview('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /dropbox/download', () => {
    it('It should download images and process them via MediaService.', async () => {
      const fakeBuffer = Buffer.from('fake');
      mockDropboxService.downloadFile.mockResolvedValue(fakeBuffer);
      mockMediaService.processAndUpload.mockResolvedValue({
        id: 'media-1',
        thumb: 'https://cdn/thumb.webp',
        card: 'https://cdn/card.webp',
        gallery: 'https://cdn/gallery.webp',
        full: 'https://cdn/full.webp',
      });

      const result = await controller.download({
        paths: ['/Root/image1.jpg', '/Root/image2.png'],
      });

      expect(mockDropboxService.downloadFile).toHaveBeenCalledTimes(2);
      expect(mockMediaService.processAndUpload).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('media-1');
    });

    it('It should reject empty arrays (validation via class-validator).', async () => {

      const dto = plainToInstance(DropboxPathsDto, { paths: [] });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toMatchObject({
        arrayMinSize: expect.any(String),
      });
    });
  });

  describe('PUT /dropbox/settings', () => {
    it('It should save encrypted credentials.', async () => {
      await controller.saveSettings({
        accessToken: 'token123',
        refreshToken: 'refresh456',
        appKey: 'key789',
        appSecret: 'secret012',
        rootPath: '/Miniaturas',
      });

      expect(mockSettingsService.set).toHaveBeenCalledWith(
        'dropbox_access_token',
        'enc:token123',
      );
      expect(mockSettingsService.set).toHaveBeenCalledWith(
        'dropbox_root_path',
        '/Miniaturas',
      );
    });
  });
});
