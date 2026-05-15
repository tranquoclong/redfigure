import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Dropbox } from 'dropbox';
import { SettingsService } from '../settings/settings.service';

export interface DropboxListResult {
  path: string;
  folders: Array<{ name: string; path: string }>;
  images: Array<{ name: string; path: string }>;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const dropboxLogger = new Logger('DropboxService');

function sanitizeDropboxMessage(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? '');
  return msg.replace(
    /(refresh_token|access_token|client_secret|code)=[^&\s"']+/gi,
    '$1=[REDACTED]',
  );
}

async function safeCall<T>(fn: () => Promise<T>, opName: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {

    dropboxLogger.error(
      `Dropbox ${opName} failed: ${sanitizeDropboxMessage(err)}`,
    );

    throw new BadRequestException(
      `Failed to ${opName} on Dropbox. Please check the configuration or try again.`,
    );
  }
}

@Injectable()
export class DropboxService {
  private readonly logger = new Logger(DropboxService.name);

  constructor(private readonly settingsService: SettingsService) { }

  private async getClient(): Promise<Dropbox> {

    const fresh = await this.settingsService.getManyFresh([
      'dropbox_access_token',
      'dropbox_refresh_token',
      'dropbox_app_key',
      'dropbox_app_secret',
    ]);
    const encToken = fresh.dropbox_access_token ?? null;
    const encRefresh = fresh.dropbox_refresh_token ?? null;
    const appKey = fresh.dropbox_app_key ?? null;
    const appSecret = fresh.dropbox_app_secret ?? null;

    const accessToken = encToken
      ? this.settingsService.decrypt(encToken)
      : null;
    const refreshToken = encRefresh
      ? this.settingsService.decrypt(encRefresh)
      : null;

    if (!accessToken) {
      throw new BadRequestException(
        'Dropbox not configured. Please add the token in the settings.',
      );
    }

    const opts: Record<string, unknown> = {
      accessToken,
      refreshToken: refreshToken ?? undefined,
      clientId: appKey ?? undefined,
      clientSecret: appSecret
        ? this.settingsService.decrypt(appSecret)
        : undefined,
    };

    try {
      const probe = new Dropbox(opts as any);
      const account = await probe.usersGetCurrentAccount();
      const rootNsId =
        (account.result as any).root_info?.root_namespace_id ?? null;
      if (rootNsId) {
        opts.pathRoot = JSON.stringify({
          '.tag': 'root',
          root: rootNsId,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Could not detect team namespace: ${sanitizeDropboxMessage(err)}`,
      );
    }

    return new Dropbox(opts as any);
  }

  async listFolder(path: string): Promise<DropboxListResult> {
    const client = await this.getClient();

    const folders: Array<{ name: string; path: string }> = [];
    const images: Array<{ name: string; path: string }> = [];

    let response = await safeCall(
      () => client.filesListFolder({ path: path === '/' ? '' : path }),
      'list folder',
    );

    const processEntries = (
      entries: Array<{
        '.tag': string;
        name: string;
        path_display?: string;
        path_lower?: string;
      }>,
    ) => {
      for (const entry of entries) {
        if (entry['.tag'] === 'folder') {
          folders.push({
            name: entry.name,
            path: entry.path_display ?? entry.path_lower ?? '',
          });
        } else if (entry['.tag'] === 'file') {
          const ext = entry.name
            .toLowerCase()
            .slice(entry.name.lastIndexOf('.'));
          if (IMAGE_EXTENSIONS.includes(ext)) {
            images.push({
              name: entry.name,
              path: entry.path_display ?? entry.path_lower ?? '',
            });
          }
        }
      }
    };

    processEntries(response.result.entries as any[]);

    while (response.result.has_more) {
      response = await safeCall(
        () =>
          client.filesListFolderContinue({ cursor: response.result.cursor }),
        'list folder (continue)',
      );
      processEntries(response.result.entries as any[]);
    }

    return { path, folders, images };
  }

  async getTemporaryLink(path: string): Promise<string> {
    const client = await this.getClient();
    const response = await safeCall(
      () => client.filesGetTemporaryLink({ path }),
      'generate preview link',
    );
    return response.result.link;
  }

  async getThumbnailsBatch(
    paths: string[],
  ): Promise<Array<{ path: string; thumbnail: string | null }>> {
    if (paths.length === 0) return [];
    const client = await this.getClient();
    const CHUNK_SIZE = 25;
    const results: Array<{ path: string; thumbnail: string | null }> = [];

    for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
      const chunk = paths.slice(i, i + CHUNK_SIZE);
      const entries = chunk.map((p) => ({
        path: p,
        format: { '.tag': 'jpeg' as const },
        size: { '.tag': 'w256h256' as const },
        mode: { '.tag': 'strict' as const },
      }));

      try {
        const response = await safeCall(
          () =>
            client.filesGetThumbnailBatch({
              entries: entries as unknown as Parameters<
                typeof client.filesGetThumbnailBatch
              >[0]['entries'],
            }),
          'generate thumbnail batch',
        );

        response.result.entries.forEach((entry, idx) => {
          const origPath = chunk[idx] ?? '';
          if (entry['.tag'] === 'success') {
            results.push({
              path: origPath,
              thumbnail: `data:image/jpeg;base64,${entry.thumbnail}`,
            });
          } else {
            results.push({ path: origPath, thumbnail: null });
          }
        });
      } catch (err) {

        this.logger.warn(
          `Thumbnail batch chunk ${i}-${i + chunk.length} failed: ${err instanceof Error ? err.message : err}`,
        );
        for (const p of chunk) {
          results.push({ path: p, thumbnail: null });
        }
      }
    }

    return results;
  }

  async downloadFile(path: string): Promise<Buffer> {
    const client = await this.getClient();
    const response = await safeCall(
      () => client.filesDownload({ path }),
      'download file',
    );
    return (response.result as any).fileBinary;
  }

  async renameFolder(fromPath: string, toPath: string): Promise<void> {
    const client = await this.getClient();
    await safeCall(
      () =>
        client.filesMoveV2({
          from_path: fromPath,
          to_path: toPath,
          autorename: false,
        }),
      'rename folder',
    );
  }
}
