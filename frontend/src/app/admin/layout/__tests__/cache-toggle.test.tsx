import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock('@/lib/api-client', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

const revalidateAllSiteMock = vi.fn();
vi.mock('../_actions', () => ({
  revalidateAllSite: () => revalidateAllSiteMock(),
}));

import { CacheToggle } from '../cache-toggle';

describe('CacheToggle', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    revalidateAllSiteMock.mockReset();
  });

  it('does GET /admin/site/cache/status on mount + shows "Cache active" when disabled=false', async () => {
    apiGetMock.mockResolvedValue({ data: { data: { disabled: false } } });

    render(<CacheToggle />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/admin/site/cache/status');
    });
    await waitFor(() => {
      expect(screen.getByText(/Cache active/i)).toBeInTheDocument();
    });

    expect(screen.getByTestId('cache-toggle')).toHaveAttribute(
      'data-unchecked',
    );
  });

  it('when status=disabled=true, shows "Cache disabled" + warning + Switch ON', async () => {
    apiGetMock.mockResolvedValue({ data: { data: { disabled: true } } });

    render(<CacheToggle />);

    await waitFor(() => {
      expect(screen.getByText(/Cache disabled/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Reduced performance/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('cache-toggle')).toHaveAttribute(
      'data-checked',
    );
  });

  it('clicking on toggle (OFF→ON) calls POST /toggle with {disabled:true} + revalidateAllSite', async () => {
    apiGetMock.mockResolvedValue({ data: { data: { disabled: false } } });
    apiPostMock.mockResolvedValue({ data: { data: { disabled: true } } });
    revalidateAllSiteMock.mockResolvedValue(undefined);

    render(<CacheToggle />);

    await waitFor(() => {
      expect(screen.getByTestId('cache-toggle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('cache-toggle'));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/admin/site/cache/toggle',
        { disabled: true },
      );
    });
    expect(revalidateAllSiteMock).toHaveBeenCalled();
  });

  it('when POST fails, reverts visual state + shows error', async () => {
    apiGetMock.mockResolvedValue({ data: { data: { disabled: false } } });
    apiPostMock.mockRejectedValue({
      response: { data: { message: 'Throttled' } },
    });

    render(<CacheToggle />);

    await waitFor(() => {
      expect(screen.getByTestId('cache-toggle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('cache-toggle'));

    await waitFor(() => {
      expect(screen.getByText(/Throttled/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('cache-toggle')).toHaveAttribute(
      'data-unchecked',
    );
  });

  it('when GET status fails, default fail-safe is active cache (disabled=false)', async () => {
    apiGetMock.mockRejectedValue(new Error('network'));

    render(<CacheToggle />);

    await waitFor(() => {
      expect(screen.getByText(/Cache active/i)).toBeInTheDocument();
    });
  });
});
