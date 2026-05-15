import { describe, it, expect, vi } from 'vitest';
import { bulkDeleteMedia } from './bulk-delete-media';

describe('bulkDeleteMedia', () => {
  it('returns empty failed when all deletes succeed', async () => {
    const del = vi.fn().mockResolvedValue({ data: {} });

    const result = await bulkDeleteMedia(['a', 'b', 'c'], { delete: del });

    expect(result.succeeded).toEqual(['a', 'b', 'c']);
    expect(result.failed).toEqual([]);
    expect(del).toHaveBeenCalledTimes(3);
    expect(del).toHaveBeenCalledWith('/media/a');
    expect(del).toHaveBeenCalledWith('/media/b');
    expect(del).toHaveBeenCalledWith('/media/c');
  });

  it('partitions succeeded and failed ids', async () => {
    const del = vi
      .fn()
      .mockResolvedValueOnce({ data: {} })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ data: {} })
      .mockRejectedValueOnce(new Error('nope'));

    const result = await bulkDeleteMedia(['a', 'b', 'c', 'd'], { delete: del });

    expect(result.succeeded).toEqual(['a', 'c']);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0]).toMatchObject({ id: 'b' });
    expect(result.failed[1]).toMatchObject({ id: 'd' });
  });

  it('extracts readable error message from axios-shaped error', async () => {
    const axiosErr = {
      response: {
        data: { error: { message: 'Conflict: media in use' } },
      },
    };
    const del = vi.fn().mockRejectedValue(axiosErr);

    const result = await bulkDeleteMedia(['x'], { delete: del });

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([
      { id: 'x', message: 'Conflict: media in use' },
    ]);
  });

  it('falls back to generic message for unrecognizable error shape', async () => {
    const del = vi.fn().mockRejectedValue('just a string');

    const result = await bulkDeleteMedia(['x'], { delete: del });

    expect(result.failed).toEqual([{ id: 'x', message: 'Unknown error' }]);
  });

  it('short-circuits on empty id list', async () => {
    const del = vi.fn();

    const result = await bulkDeleteMedia([], { delete: del });

    expect(result).toEqual({ succeeded: [], failed: [] });
    expect(del).not.toHaveBeenCalled();
  });

  it('deduplicates ids before dispatching requests', async () => {
    const del = vi.fn().mockResolvedValue({ data: {} });

    const result = await bulkDeleteMedia(['a', 'a', 'b'], { delete: del });

    expect(del).toHaveBeenCalledTimes(2);
    expect(result.succeeded.sort()).toEqual(['a', 'b']);
  });

  it('handles unexpected error shapes without crashing (OLS HTML 502, non-string details, etc)', async () => {
    const del = vi
      .fn()
      .mockRejectedValueOnce('plain string')
      .mockRejectedValueOnce({ response: { data: '<html>502 Bad Gateway</html>' } })
      .mockRejectedValueOnce({ response: { data: { error: { details: 'not an array' } } } })
      .mockRejectedValueOnce({ response: { data: { error: { details: [null, 42, 'real msg'] } } } })
      .mockRejectedValueOnce({ response: { data: { message: 123 } } })
      .mockRejectedValueOnce(null);

    const result = await bulkDeleteMedia(
      ['a', 'b', 'c', 'd', 'e', 'f'],
      { delete: del },
    );

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toHaveLength(6);

    for (const f of result.failed) {
      expect(typeof f.message).toBe('string');
      expect(f.message.length).toBeGreaterThan(0);
    }

    expect(result.failed[3].message).toBe('real msg');
  });

  it('rejects malformed ids without making HTTP requests (path traversal defense)', async () => {
    const del = vi.fn().mockResolvedValue({ data: {} });

    const result = await bulkDeleteMedia(
      [
        'valid-cuid-123',
        '../users/admin',
        'has space',
        '',
        'ok_with_underscore',
        'a'.repeat(100),
        '../../../etc/passwd',
      ],
      { delete: del },
    );

    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith('/media/valid-cuid-123');
    expect(del).toHaveBeenCalledWith('/media/ok_with_underscore');
    expect(result.succeeded.sort()).toEqual(['ok_with_underscore', 'valid-cuid-123']);
    expect(result.failed).toHaveLength(5);
    for (const f of result.failed) {
      expect(f.message).toBe('Invalid ID format');
    }
  });

  it('processes ids in chunks respecting browser/backend concurrency limits', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const del = vi.fn().mockImplementation(async () => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight--;
      return { data: {} };
    });

    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    const result = await bulkDeleteMedia(ids, { delete: del });

    expect(result.succeeded).toHaveLength(25);
    expect(result.failed).toEqual([]);

    expect(maxInflight).toBeLessThanOrEqual(10);
  });
});
