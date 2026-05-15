

const CHUNK_SIZE = 10;

interface BulkDeleteClient {
  delete: (url: string) => Promise<unknown>;
}

export interface BulkDeleteFailure {
  id: string;
  message: string;
}

export interface BulkDeleteResult {
  succeeded: string[];
  failed: BulkDeleteFailure[];
}

function extractMessage(err: unknown): string {

  try {
    const data = (
      err as {
        response?: {
          data?: {
            error?: { message?: unknown; details?: unknown };
            message?: unknown;
          };
        };
      }
    )?.response?.data;

    const details = data?.error?.details;
    if (Array.isArray(details) && details.length > 0) {
      return details.filter((d) => typeof d === 'string').join(', ') || 'Erro desconhecido';
    }
    const errorMessage = data?.error?.message;
    if (typeof errorMessage === 'string' && errorMessage) return errorMessage;
    const rootMessage = data?.message;
    if (typeof rootMessage === 'string' && rootMessage) return rootMessage;
    if (err instanceof Error && err.message) return err.message;
    return 'Erro desconhecido';
  } catch {
    return 'Erro desconhecido';
  }
}

const ID_FORMAT = /^[a-zA-Z0-9_-]+$/;
const ID_MAX_LEN = 64;

function isValidId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= ID_MAX_LEN &&
    ID_FORMAT.test(id)
  );
}

export async function bulkDeleteMedia(
  ids: string[],
  client: BulkDeleteClient,
): Promise<BulkDeleteResult> {
  if (ids.length === 0) return { succeeded: [], failed: [] };

  const uniqueIds = Array.from(new Set(ids));

  const succeeded: string[] = [];
  const failed: BulkDeleteFailure[] = [];

  const validIds: string[] = [];
  for (const id of uniqueIds) {
    if (isValidId(id)) {
      validIds.push(id);
    } else {
      failed.push({ id: String(id), message: 'ID em formato invalido' });
    }
  }

  for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
    const chunk = validIds.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((id) => client.delete(`/media/${id}`)),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const id = chunk[j];
      if (r.status === 'fulfilled') {
        succeeded.push(id);
      } else {
        failed.push({ id, message: extractMessage(r.reason) });
      }
    }
  }
  return { succeeded, failed };
}
