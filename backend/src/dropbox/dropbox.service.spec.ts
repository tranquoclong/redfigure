import { Test, TestingModule } from '@nestjs/testing';
import { DropboxService } from './dropbox.service';
import { SettingsService } from '../settings/settings.service';
import { BadRequestException } from '@nestjs/common';
import { Dropbox } from 'dropbox';

jest.mock('dropbox', () => ({
  Dropbox: jest.fn().mockImplementation(() => ({
    filesListFolder: jest.fn(),
    filesListFolderContinue: jest.fn(),
    filesGetTemporaryLink: jest.fn(),
    filesDownload: jest.fn(),
    filesMoveV2: jest.fn(),
  })),
}));

const MockedDropbox = jest.mocked(Dropbox);

function setupTokenMocks(mock: typeof mockSettingsService) {

  mock.getManyFresh.mockResolvedValueOnce({
    dropbox_access_token: 'token',
    dropbox_refresh_token: 'refresh',
    dropbox_app_key: 'key',
    dropbox_app_secret: 'secret',
  });
  mock.decrypt.mockImplementation((v: string) => v);
}

const mockSettingsService = {
  get: jest.fn(),
  getManyFresh: jest.fn(),
  decrypt: jest.fn((v: string) => v),
};

describe('DropboxService', () => {
  let service: DropboxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DropboxService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<DropboxService>(DropboxService);

    jest.clearAllMocks();
  });

  describe('getClient', () => {
    it('should throw BadRequestException when token is not configured', async () => {
      mockSettingsService.getManyFresh.mockResolvedValue({});

      await expect(service.listFolder('/')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listFolder', () => {
    it('It should list folders and images by filtering by extension.', async () => {
      setupTokenMocks(mockSettingsService);

      const mockClient = {
        filesListFolder: jest.fn().mockResolvedValue({
          result: {
            entries: [
              {
                '.tag': 'folder',
                name: 'SubPasta',
                path_lower: '/root/subpasta',
                path_display: '/Root/SubPasta',
              },
              {
                '.tag': 'file',
                name: 'image1.jpg',
                path_lower: '/root/image1.jpg',
                path_display: '/Root/image1.jpg',
              },
              {
                '.tag': 'file',
                name: 'document.pdf',
                path_lower: '/root/document.pdf',
                path_display: '/Root/document.pdf',
              },
              {
                '.tag': 'file',
                name: 'photo.png',
                path_lower: '/root/photo.png',
                path_display: '/Root/photo.png',
              },
            ],
            has_more: false,
          },
        }),
      };
      MockedDropbox.mockImplementation(() => mockClient as any);

      const result = await service.listFolder('/Root');

      expect(result.path).toBe('/Root');
      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].name).toBe('SubPasta');
      expect(result.images).toHaveLength(2);
      expect(result.images[0].name).toBe('image1.jpg');
      expect(result.images[1].name).toBe('photo.png');
    });
  });

  describe('getTemporaryLink', () => {
    it('It should return a temporary preview link.', async () => {
      setupTokenMocks(mockSettingsService);

      const mockClient = {
        filesGetTemporaryLink: jest.fn().mockResolvedValue({
          result: { link: 'https://dl.dropbox.com/temp/image.jpg' },
        }),
      };
      MockedDropbox.mockImplementation(() => mockClient as any);

      const result = await service.getTemporaryLink('/Root/image.jpg');

      expect(result).toBe('https://dl.dropbox.com/temp/image.jpg');
    });
  });

  describe('downloadFile', () => {
    it('should return the downloaded file buffer.', async () => {
      setupTokenMocks(mockSettingsService);

      const fileBuffer = Buffer.from('fake image data');
      const mockClient = {
        filesDownload: jest.fn().mockResolvedValue({
          result: { fileBinary: fileBuffer },
        }),
      };
      MockedDropbox.mockImplementation(() => mockClient as any);

      const result = await service.downloadFile('/Root/image.jpg');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(fileBuffer);
    });
  });

  describe('error handling (no token/secret leak)', () => {
    it('never surfaces SDK error details (tokens/URLs) to clients — returns generic message', async () => {
      setupTokenMocks(mockSettingsService);

      const leakyMsg =
        'request to https://api.dropboxapi.com/oauth2/token?grant_type=refresh_token&refresh_token=AAAASECRET123&client_id=abc&client_secret=TOPSECRET failed, reason:';
      const mockClient = {
        filesListFolder: jest.fn().mockRejectedValue(new Error(leakyMsg)),
      };
      MockedDropbox.mockImplementation(() => mockClient as any);

      try {
        await service.listFolder('/Anything');
        fail('expected throw');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).not.toContain('AAAASECRET123');
        expect(message).not.toContain('TOPSECRET');
        expect(message).not.toContain('api.dropboxapi.com');

        expect(message).toMatch(/Dropbox/i);
      }
    });
  });

  describe('renameFolder', () => {
    it('It should move the folder in Dropbox.', async () => {
      setupTokenMocks(mockSettingsService);

      const mockClient = {
        filesMoveV2: jest.fn().mockResolvedValue({ result: {} }),
      };
      MockedDropbox.mockImplementation(() => mockClient as any);

      await service.renameFolder('/Old/Path', '/New/Path');

      expect(mockClient.filesMoveV2).toHaveBeenCalledWith({
        from_path: '/Old/Path',
        to_path: '/New/Path',
        autorename: false,
      });
    });
  });
});
