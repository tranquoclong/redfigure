import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiPostMock = vi.fn();
vi.mock('@/lib/api-client', () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
    get: vi.fn(),
  },
}));

const revalidateAllSiteMock = vi.fn();
vi.mock('../_actions', () => ({
  revalidateAllSite: () => revalidateAllSiteMock(),
}));

import { FlushCacheButton } from '../flush-cache-button';

describe('FlushCacheButton', () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    revalidateAllSiteMock.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders "Clear cache" button in idle state', () => {
    render(<FlushCacheButton />);
    expect(
      screen.getByRole('button', { name: /Clear cache/i }),
    ).toBeInTheDocument();
  });

  it('calls POST /admin/site/cache/flush + revalidateAllSite + shows flushed count', async () => {
    apiPostMock.mockResolvedValue({
      data: {
        data: {
          flushed: ['cache:site:topbar', 'cache:site:footer', 'cache:site:home-blocks'],
          failed: [],
          scannedCount: 3,
        },
      },
    });
    revalidateAllSiteMock.mockResolvedValue(undefined);

    render(<FlushCacheButton />);
    fireEvent.click(screen.getByTestId('flush-cache-button'));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/admin/site/cache/flush');
    });
    expect(revalidateAllSiteMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText(/3 keys cleared/i)).toBeInTheDocument();
    });
  });

  it('when some keys fail (failed.length > 0), shows error state', async () => {
    apiPostMock.mockResolvedValue({
      data: {
        data: {
          flushed: ['cache:site:topbar'],
          failed: ['cache:site:footer'],
          scannedCount: 2,
        },
      },
    });

    render(<FlushCacheButton />);
    fireEvent.click(screen.getByTestId('flush-cache-button'));

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/1 of 2 keys failed to clear/i),
    ).toBeInTheDocument();
  });

  it('when 0 keys scanned, displays "Cache was already empty" message', async () => {
    apiPostMock.mockResolvedValue({
      data: {
        data: { flushed: [], failed: [], scannedCount: 0 },
      },
    });

    render(<FlushCacheButton />);
    fireEvent.click(screen.getByTestId('flush-cache-button'));

    await waitFor(() => {
      expect(
        screen.getByText(/Cache was already empty/i),
      ).toBeInTheDocument();
    });
  });

  it('when user cancels confirm(), does not call API', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<FlushCacheButton />);
    fireEvent.click(screen.getByTestId('flush-cache-button'));

    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('when API returns error, displays error state with extracted message', async () => {
    apiPostMock.mockRejectedValue({
      response: { data: { message: 'Redis unavailable' } },
    });

    render(<FlushCacheButton />);
    fireEvent.click(screen.getByTestId('flush-cache-button'));

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });
});
